import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from "react-native";
import { useTheme } from "../../src/contexts/ThemeContext.js";
import { useFeedback } from "../../src/hooks/useFeedback.js";
import { useCurrencies } from "../../src/hooks/useCurrencies.js";
import { FeedbackBanner } from "../../src/components/FeedbackBanner.jsx";
import { CurrencyPicker } from "../../src/components/CurrencyPicker.jsx";
import { CategoryChips } from "../../src/components/CategoryChips.jsx";
import { CalendarPicker } from "../../src/components/CalendarPicker.jsx";
import {
  listRecurring,
  createRecurring,
  updateRecurring,
  deactivateRecurring,
  reactivateRecurring,
  deleteRecurring,
} from "../../src/services/recurring.js";
import { toApiTransactionType, toApiNecessity, formatCurrency } from "../../src/utils/enums.js";
import { logger } from "../../src/utils/logger.js";

const FREQ_OPTIONS = [
  { id: "MONTHLY", label: "Monthly" },
  { id: "WEEKLY",  label: "Weekly"  },
  { id: "YEARLY",  label: "Yearly"  },
  { id: "DAILY",   label: "Daily"   },
];
const DAY_LABELS   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_SHORT  = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL   = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nextLabel(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(d, 10)} ${MONTH_SHORT[parseInt(m, 10)]} ${y}`;
}

function scheduleLabel({ frequency, dayOfWeek, dayOfMonth, monthOfYear }) {
  if (frequency === "WEEKLY")  return `Every ${DAY_LABELS[(dayOfWeek ?? 1) - 1]}`;
  if (frequency === "MONTHLY") return `Every month on day ${dayOfMonth}`;
  if (frequency === "YEARLY")  return `Every ${MONTH_SHORT[monthOfYear] ?? ""} on day ${dayOfMonth}`;
  return "Every day";
}

export function RecurringScreen({
  user,
  incomeCategories,
  expenseCategories,
  investmentCategories = [],
  colorMap,
  onCurrencyPickerOpen,
}) {
  const { colors: C, styles: S } = useTheme();
  const { feedback, flash }      = useFeedback();
  const { currencyList, loading: currenciesLoading, load: loadCurrencies } = useCurrencies();

  // ── List state ────────────────────────────────────────────────────────────
  const [templates, setTemplates]     = useState([]);
  const [listLoading, setListLoading] = useState(false);

  // ── Form visibility: "add" | recurringId (edit) | null ───────────────────
  const [formMode, setFormMode]       = useState(null);

  // ── Shared form state ─────────────────────────────────────────────────────
  const [type, setType]               = useState("expense");
  const [amount, setAmount]           = useState("");
  const [currency, setCurrency]       = useState(user?.currency ?? "EUR");
  const [note, setNote]               = useState("");
  const [categoryId, setCategoryId]   = useState(null);
  const [necessity, setNecessity]     = useState("necessary");
  const [frequency, setFrequency]     = useState("MONTHLY");
  const [dayOfMonth, setDayOfMonth]   = useState("1");
  const [dayOfWeek, setDayOfWeek]     = useState("1");
  const [monthOfYear, setMonthOfYear] = useState("1");
  const [startDate, setStartDate]     = useState(localToday());
  const [endDate, setEndDate]         = useState("");
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker]     = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [saving, setSaving]           = useState(false);

  const isEditMode = formMode !== null && formMode !== "add";
  const showForm   = formMode !== null;

  const cats = type === "income" ? incomeCategories : type === "investment" ? investmentCategories : expenseCategories;

  const load = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await listRecurring();
      setTemplates(data ?? []);
    } catch (e) {
      logger.error("recurring", "load failed", e.message);
      flash(false, e.message || "Failed to load recurring payments");
    } finally {
      setListLoading(false);
    }
  }, [flash]);

  useEffect(() => { load(); }, [load]);

  function switchType(t) {
    setType(t);
    const list = t === "income" ? incomeCategories : t === "investment" ? investmentCategories : expenseCategories;
    setCategoryId(list[0]?.categoryId ?? list[0]?.id ?? null);
  }

  function resetForm() {
    setType("expense");
    setAmount("");
    setCurrency(user?.currency ?? "EUR");
    setNote("");
    setCategoryId(null);
    setNecessity("necessary");
    setFrequency("MONTHLY");
    setDayOfMonth("1");
    setDayOfWeek("1");
    setMonthOfYear("1");
    setStartDate(localToday());
    setEndDate("");
    setShowStartPicker(false);
    setShowEndPicker(false);
    setFormMode(null);
  }

  function openEdit(t) {
    setFormMode(t.recurringId);
    const rawType = (t.type ?? "EXPENSE").toLowerCase();
    setType(rawType);
    setAmount(String(parseFloat(t.amount?.value ?? 0)));
    setCurrency(t.amount?.currency ?? user?.currency ?? "EUR");
    setNote(t.note ?? "");
    setCategoryId(t.categoryId ?? null);
    setNecessity(t.necessity === "OPTIONAL" ? "optional" : "necessary");
    setFrequency(t.frequency ?? "MONTHLY");
    setDayOfMonth(String(t.dayOfMonth ?? 1));
    setDayOfWeek(String(t.dayOfWeek ?? 1));
    setMonthOfYear(String(t.monthOfYear ?? 1));
    setStartDate(t.startDate ?? localToday());
    setEndDate(t.endDate ?? "");
    setShowStartPicker(false);
    setShowEndPicker(false);
    setShowCurrencyPicker(false);
  }

  function buildPayload() {
    const parsed = parseFloat(amount.replace(/,/g, "."));
    const selectedCat = cats.find(c => (c.categoryId ?? c.id) === categoryId);
    const catName = selectedCat?.name ?? "";
    return {
      amount:      { value: parsed, currency },
      categoryId,
      name:        note.trim() && catName
                     ? `${note.trim()} - ${catName}`
                     : (note.trim() || catName || type),
      note:        note.trim() || "",
      type:        toApiTransactionType(type),
      necessity:   toApiNecessity(type === "expense" ? necessity : "necessary"),
      frequency,
      dayOfMonth:  ["MONTHLY", "YEARLY"].includes(frequency) ? parseInt(dayOfMonth, 10) : null,
      dayOfWeek:   frequency === "WEEKLY" ? parseInt(dayOfWeek, 10) : null,
      monthOfYear: frequency === "YEARLY" ? parseInt(monthOfYear, 10) : null,
      startDate,
      endDate:     endDate || null,
    };
  }

  async function handleSave() {
    const parsed = parseFloat(amount.replace(/,/g, "."));
    if (!amount || isNaN(parsed) || parsed <= 0) { flash(false, "Enter a valid amount"); return; }
    if (!categoryId)             { flash(false, "Please select a category"); return; }

    setSaving(true);
    try {
      if (isEditMode) {
        const updated = await updateRecurring(formMode, buildPayload());
        setTemplates(prev => prev.map(t => t.recurringId === formMode ? updated : t));
        flash(true, "Changes saved.");
      } else {
        await createRecurring(buildPayload());
        flash(true, "Recurring payment saved.");
        await load();
      }
      resetForm();
    } catch (e) {
      flash(false, e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id) {
    try {
      const updated = await deactivateRecurring(id);
      setTemplates(prev => prev.map(t => t.recurringId === id ? updated : t));
      flash(true, "Paused.");
    } catch (e) {
      flash(false, e.message || "Failed to pause");
    }
  }

  async function handleReactivate(id) {
    try {
      const updated = await reactivateRecurring(id);
      setTemplates(prev => prev.map(t => t.recurringId === id ? updated : t));
      flash(true, "Resumed.");
    } catch (e) {
      flash(false, e.message || "Failed to resume");
    }
  }

  async function handleDelete(id) {
    Alert.alert(
      "Delete recurring payment?",
      "This will permanently remove the template. Past entries are not affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRecurring(id);
              setTemplates(prev => prev.filter(t => t.recurringId !== id));
              flash(true, "Deleted.");
            } catch (e) {
              flash(false, e.message || "Failed to delete");
            }
          },
        },
      ]
    );
  }

  const accent = type === "income" ? C.green : type === "investment" ? C.blue : C.red;

  const active   = templates.filter(t => t.active);
  const inactive = templates.filter(t => !t.active);

  const allCategories = [...(expenseCategories ?? []), ...(incomeCategories ?? []), ...(investmentCategories ?? [])];
  function findCategory(id) {
    return allCategories.find(c => (c.categoryId ?? c.id) === id) ?? null;
  }

  function typeColor(apiType) {
    if (apiType === "INCOME")     return { color: C.green,   bg: C.greenLight,  border: C.greenBorder };
    if (apiType === "INVESTMENT") return { color: C.blue,    bg: C.blueLight,   border: C.blueBorder  };
    return                               { color: C.red,     bg: C.redLight,    border: C.redBorder   };
  }
  function typeEmoji(apiType) {
    if (apiType === "INCOME")     return "💰";
    if (apiType === "INVESTMENT") return "📈";
    return "💸";
  }

  // ── Shared form render ────────────────────────────────────────────────────
  function renderForm() {
    return (
      <View>
        {/* Type toggle */}
        <View style={[S.row, { gap: 8, marginBottom: 18 }]}>
          {[
            { id: "expense",    label: "💸 Expense",  activeColor: C.red,   activeBg: C.redLight,   activeText: C.redDark   },
            { id: "income",     label: "💰 Income",    activeColor: C.green, activeBg: C.greenLight, activeText: C.greenDark },
            { id: "investment", label: "📈 Invest",    activeColor: C.blue,  activeBg: C.blueLight,  activeText: C.blueDark  },
          ].map(t => (
            <TouchableOpacity
              key={t.id}
              onPress={() => switchType(t.id)}
              style={{
                flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, alignItems: "center",
                borderColor: type === t.id ? t.activeColor : C.border,
                backgroundColor: type === t.id ? t.activeBg : C.bgSecondary,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: type === t.id ? "700" : "400", color: type === t.id ? t.activeText : C.textTertiary }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Amount + currency */}
        <View style={[S.rowBetween, { marginBottom: 6 }]}>
          <Text style={S.label}>Amount</Text>
          <TouchableOpacity
            onPress={() => { onCurrencyPickerOpen?.(); loadCurrencies(); setShowCurrencyPicker(true); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: C.greenLight, borderWidth: 0.5, borderColor: C.greenBorder }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: C.greenDark }}>{currency}</Text>
            <Text style={{ fontSize: 11, color: C.greenDark }}>▾</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={[S.input, { fontSize: 32, fontFamily: "Courier", fontWeight: "700", textAlign: "center", borderColor: accent, borderWidth: 1.5 }]}
          placeholder="0.00"
          placeholderTextColor={C.textTertiary}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <CurrencyPicker
          visible={showCurrencyPicker}
          selected={currency}
          currencyList={currencyList}
          loading={currenciesLoading}
          onSelect={c => { setCurrency(c); setShowCurrencyPicker(false); }}
          onClose={() => setShowCurrencyPicker(false)}
        />

        {/* Necessity — expense only */}
        {type === "expense" && (
          <>
            <Text style={[S.label, { marginBottom: 8, marginTop: 4 }]}>Type</Text>
            <View style={[S.row, { gap: 8, marginBottom: 18 }]}>
              {[
                { id: "necessary", emoji: "🔒", label: "Necessary", sub: "Can't cut this",  activeColor: C.red,   activeBg: C.redLight,   activeText: C.redDark   },
                { id: "optional",  emoji: "✂️", label: "Optional",  sub: "Could save here", activeColor: C.amber, activeBg: C.amberLight, activeText: C.amberDark },
              ].map(n => (
                <TouchableOpacity
                  key={n.id}
                  onPress={() => setNecessity(n.id)}
                  style={{
                    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
                    paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5,
                    borderColor: necessity === n.id ? n.activeColor : C.border,
                    backgroundColor: necessity === n.id ? n.activeBg : C.bgSecondary,
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{n.emoji}</Text>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: necessity === n.id ? "700" : "500", color: necessity === n.id ? n.activeText : C.text }}>{n.label}</Text>
                    <Text style={{ fontSize: 11, color: C.textTertiary }}>{n.sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Category */}
        <Text style={[S.label, { marginBottom: 8 }]}>Category</Text>
        <CategoryChips
          categories={cats}
          selected={categoryId}
          onSelect={id => setCategoryId(id?.categoryId ?? id?.id ?? id)}
          colorMap={colorMap}
          style={{ marginBottom: 18 }}
        />

        {/* Note */}
        <Text style={[S.label, { marginBottom: 6 }]}>Note (optional)</Text>
        <TextInput
          style={S.input}
          placeholder="What is it for?"
          placeholderTextColor={C.textTertiary}
          value={note}
          onChangeText={setNote}
        />

        {/* Frequency */}
        <Text style={[S.label, { marginTop: 4, marginBottom: 8 }]}>Repeats</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {FREQ_OPTIONS.map(f => (
            <TouchableOpacity
              key={f.id}
              onPress={() => setFrequency(f.id)}
              style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
                borderColor: frequency === f.id ? "#6B63B5" : C.border,
                backgroundColor: frequency === f.id ? "#ECEAF8" : C.bgSecondary,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: frequency === f.id ? "700" : "400", color: frequency === f.id ? "#4A4390" : C.textTertiary }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Day of week */}
        {frequency === "WEEKLY" && (
          <>
            <Text style={[S.label, { marginBottom: 8 }]}>Day of week</Text>
            <View style={[S.row, { gap: 6, marginBottom: 18 }]}>
              {DAY_LABELS.map((d, i) => {
                const val = String(i + 1);
                const isActive = dayOfWeek === val;
                return (
                  <TouchableOpacity
                    key={val}
                    onPress={() => setDayOfWeek(val)}
                    style={{
                      flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, alignItems: "center",
                      borderColor: isActive ? "#6B63B5" : C.border,
                      backgroundColor: isActive ? "#ECEAF8" : C.bgSecondary,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: isActive ? "700" : "400", color: isActive ? "#4A4390" : C.textTertiary }}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Day of month */}
        {(frequency === "MONTHLY" || frequency === "YEARLY") && (
          <>
            <Text style={[S.label, { marginBottom: 8 }]}>Day of month</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => {
                const val = String(d);
                const isActive = dayOfMonth === val;
                return (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setDayOfMonth(val)}
                    style={{
                      width: 36, height: 36, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center",
                      borderColor: isActive ? "#6B63B5" : C.border,
                      backgroundColor: isActive ? "#ECEAF8" : C.bgSecondary,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: isActive ? "700" : "400", color: isActive ? "#4A4390" : C.textTertiary }}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Month of year */}
        {frequency === "YEARLY" && (
          <>
            <Text style={[S.label, { marginBottom: 8 }]}>Month of year</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
              {MONTH_FULL.slice(1).map((m, i) => {
                const val = String(i + 1);
                const isActive = monthOfYear === val;
                return (
                  <TouchableOpacity
                    key={val}
                    onPress={() => setMonthOfYear(val)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5,
                      borderColor: isActive ? "#6B63B5" : C.border,
                      backgroundColor: isActive ? "#ECEAF8" : C.bgSecondary,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: isActive ? "700" : "400", color: isActive ? "#4A4390" : C.textTertiary }}>{MONTH_SHORT[i + 1]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Start date */}
        <Text style={[S.label, { marginBottom: 6 }]}>Starts on</Text>
        <TouchableOpacity
          onPress={() => setShowStartPicker(v => !v)}
          style={{ backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}
        >
          <Text style={{ fontSize: 15, color: C.text }}>
            {new Date(startDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
          </Text>
          <Text style={{ fontSize: 16, color: C.textTertiary }}>📅</Text>
        </TouchableOpacity>
        {showStartPicker && (
          <View style={{ marginBottom: 12 }}>
            <CalendarPicker value={startDate} onChange={d => { setStartDate(d); setShowStartPicker(false); }} accentColor={accent} />
          </View>
        )}

        {/* End date */}
        <Text style={[S.label, { marginBottom: 6 }]}>Ends on (optional)</Text>
        <TouchableOpacity
          onPress={() => setShowEndPicker(v => !v)}
          style={{ backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}
        >
          <Text style={{ fontSize: 15, color: endDate ? C.text : C.textTertiary }}>
            {endDate
              ? new Date(endDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })
              : "No end date"
            }
          </Text>
          <Text style={{ fontSize: 16, color: C.textTertiary }}>📅</Text>
        </TouchableOpacity>
        {showEndPicker && (
          <View style={{ marginBottom: 12 }}>
            <CalendarPicker value={endDate || startDate} onChange={d => { setEndDate(d); setShowEndPicker(false); }} accentColor={accent} />
          </View>
        )}
        {endDate ? (
          <TouchableOpacity onPress={() => setEndDate("")} style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: C.red, textAlign: "center" }}>✕ Clear end date</Text>
          </TouchableOpacity>
        ) : null}

        {/* Save button */}
        <TouchableOpacity
          style={[S.btnPrimary, { backgroundColor: accent }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={S.btnPrimaryText}>{isEditMode ? "Save changes" : "Save recurring payment"}</Text>
          }
        </TouchableOpacity>
      </View>
    );
  }

  // ── Single card renderer (active and paused) ─────────────────────────────
  function renderCard(t, isPaused) {
    const tc       = typeColor(t.type);
    const amt      = parseFloat(t.amount?.value ?? 0);
    const cur      = t.amount?.currency ?? "EUR";
    const cat      = findCategory(t.categoryId);
    const catColor = (colorMap?.[t.categoryId]) ?? "#888";
    const isEditing = formMode === t.recurringId;

    return (
      <View
        key={t.recurringId}
        style={[S.card, {
          opacity:     isPaused && !isEditing ? 0.6 : 1,
          borderWidth: 1,
          borderColor: isEditing ? "#6B63B5" : (isPaused ? C.border : tc.border),
          marginBottom: 12,
        }]}
      >
        {/* Header row */}
        <View style={[S.rowBetween, { marginBottom: (t.nextPostDate || cat) ? 6 : 0 }]}>
          <View style={[S.row, { flex: 1, gap: 10, marginRight: 8 }]}>
            <Text style={{ fontSize: 22 }}>{typeEmoji(t.type)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[S.body, { fontWeight: "600" }]} numberOfLines={1}>{t.name}</Text>
              <Text style={S.small}>{scheduleLabel(t)}</Text>
            </View>
          </View>
          {isPaused ? (
            <Text style={{ fontSize: 15, fontWeight: "700", color: C.textSecondary }}>{formatCurrency(amt, cur)}</Text>
          ) : (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: tc.color }}>{formatCurrency(amt, cur)}</Text>
              <View style={{ marginTop: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: tc.bg }}>
                <Text style={{ fontSize: 10, fontWeight: "600", color: tc.color }}>{t.frequency}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Category chip */}
        {cat && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
            {(cat.emoji || cat.icon) ? <Text style={{ fontSize: 13 }}>{cat.emoji || cat.icon}</Text> : null}
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: catColor + "22" }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: catColor }}>{cat.name}</Text>
            </View>
          </View>
        )}

        {/* Next / end dates */}
        {t.nextPostDate && (
          <Text style={[S.small, { marginBottom: 10 }]}>
            {isPaused ? "Resumes: " : "Next: "}
            <Text style={{ color: C.text, fontWeight: "600" }}>{nextLabel(t.nextPostDate)}</Text>
            {t.endDate ? <Text>  ·  Ends {nextLabel(t.endDate)}</Text> : null}
          </Text>
        )}

        {/* Inline edit form or action buttons */}
        {isEditing ? (
          <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14, marginTop: 4 }}>
            <View style={[S.rowBetween, { marginBottom: 14 }]}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#6B63B5", textTransform: "uppercase", letterSpacing: 0.5 }}>Editing</Text>
              <TouchableOpacity onPress={resetForm}>
                <Text style={{ fontSize: 13, color: C.textTertiary }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            {renderForm()}
          </View>
        ) : (
          <View style={[S.row, { gap: 8 }]}>
            <TouchableOpacity
              onPress={() => openEdit(t)}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center" }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: C.textSecondary }}>✏️ Edit</Text>
            </TouchableOpacity>
            {isPaused ? (
              <TouchableOpacity
                onPress={() => handleReactivate(t.recurringId)}
                style={{ flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center" }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: C.textSecondary }}>▶ Resume</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => handleDeactivate(t.recurringId)}
                style={{ flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center" }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: C.textSecondary }}>⏸ Pause</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => handleDelete(t.recurringId)}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: C.redBorder, alignItems: "center" }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: C.red }}>🗑 Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={S.screen}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Header + Add toggle ──────────────────────────────────────── */}
        <View style={[S.rowBetween, { marginBottom: 20 }]}>
          <Text style={S.h2}>Recurring</Text>
          <TouchableOpacity
            onPress={() => {
              if (formMode === "add") { resetForm(); }
              else { resetForm(); setFormMode("add"); }
            }}
            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: formMode === "add" ? C.bgTertiary : C.green }}
          >
            <Text style={{ color: formMode === "add" ? C.textSecondary : "#fff", fontSize: 14, fontWeight: "600" }}>
              {formMode === "add" ? "Cancel" : "+ Add"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Add form ─────────────────────────────────────────────────── */}
        {formMode === "add" && (
          <View style={[S.card, { marginBottom: 20 }]}>
            {renderForm()}
          </View>
        )}

        {/* ── Template list ─────────────────────────────────────────────── */}
        {listLoading && (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={C.green} />
          </View>
        )}

        {!listLoading && templates.length === 0 && !showForm && (
          <View style={{ paddingVertical: 48, alignItems: "center" }}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>🔄</Text>
            <Text style={[S.body, { color: C.textSecondary, marginBottom: 4 }]}>No recurring payments yet</Text>
            <Text style={[S.small, { textAlign: "center" }]}>Tap <Text style={{ fontWeight: "700" }}>+ Add</Text> to set one up</Text>
          </View>
        )}

        {!listLoading && active.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <Text style={[S.sectionTitle, { marginBottom: 12 }]}>Active</Text>
            {active.map(t => renderCard(t, false))}
          </View>
        )}

        {!listLoading && inactive.length > 0 && (
          <View>
            <Text style={[S.sectionTitle, { marginBottom: 12 }]}>Paused</Text>
            {inactive.map(t => renderCard(t, true))}
          </View>
        )}

      </ScrollView>
      <FeedbackBanner feedback={feedback} />
    </View>
  );
}
