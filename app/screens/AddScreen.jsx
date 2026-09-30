import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Keyboard, TouchableWithoutFeedback,
} from "react-native";
import { useTheme } from "../../src/contexts/ThemeContext.js";
import { toApiTransactionType, toApiNecessity } from "../../src/utils/enums.js";
import { CurrencyPicker } from "../../src/components/CurrencyPicker.jsx";
import { CalendarPicker } from "../../src/components/CalendarPicker.jsx";
import { CategoryChips } from "../../src/components/CategoryChips.jsx";
import { useKeyboardPadding } from "../../src/hooks/useKeyboardPadding.js";

export function AddScreen({ onAdd, authorName, currency = "EUR", currencyList = [], currenciesLoading = false, onCurrencyPickerOpen, incomeCategories, expenseCategories, investmentCategories = [], colorMap }) {
  const { colors: C, styles: S } = useTheme();
  const keyboardPadding = useKeyboardPadding();
  const [type, setType]               = useState("expense");
  const [amount, setAmount]           = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  useEffect(() => { setSelectedCurrency(currency); }, [currency]);

  const [category, setCategory]       = useState(() => expenseCategories[0]?.id || expenseCategories[0]?.categoryId || "");
  const [necessity, setNecessity]     = useState("necessary");
  const [note, setNote]               = useState("");
  const [date, setDate]               = useState(new Date().toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [flash, setFlash]             = useState(null);
  const flashTimerRef                 = useRef(null);

  // Clean up flash timer on unmount
  useEffect(() => {
    return () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current); };
  }, []);

  const cats = type === "income" ? incomeCategories : type === "investment" ? investmentCategories : expenseCategories;

  // When categories finish loading, ensure the selected category is valid for
  // the current type. On initial render categories may be empty (still loading),
  // leaving category as "". This effect corrects that once they arrive.
  useEffect(() => {
    if (!category && cats.length > 0) {
      setCategory(cats[0]?.id || cats[0]?.categoryId || "");
    }
  }, [cats, category]);

  function switchType(t) {
    setType(t);
    const first = t === "income" ? incomeCategories[0] : t === "investment" ? investmentCategories[0] : expenseCategories[0];
    setCategory(first?.id || first?.categoryId || "");
  }

  async function handleSubmit() {
    const amt = parseFloat(amount.replace(",", "."));
    if (!amt || amt <= 0) { setFlash({ ok: false, msg: "Enter a valid amount" }); return; }
    if (!category) { setFlash({ ok: false, msg: "Please select a category" }); return; }
    setSaving(true);
    try {
      await onAdd({
        type:       toApiTransactionType(type),
        amount:     { value: amt, currency: selectedCurrency },
        categoryId: category,
        necessity:  toApiNecessity(necessity),
        note:       note.trim() || "",
        name:       note.trim() || "Transaction",
        date,
      });
      setAmount(""); setNote("");
      setFlash({ ok: true, msg: "✓ Saved" });
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => { flashTimerRef.current = null; setFlash(null); }, 1800);
    } catch (e) {
      setFlash({ ok: false, msg: e?.message || "Failed to save" });
    } finally { setSaving(false); }
  }

  const accent      = type === "income" ? C.green : type === "investment" ? C.blue : C.red;
  const accentLight = type === "income" ? C.greenLight : type === "investment" ? C.blueLight : C.redLight;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ScrollView
        style={S.screen}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 40 + keyboardPadding }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type toggle */}
        <View style={[S.row, { gap: 8, marginBottom: 22 }]}>
          {[
            { id: "expense",    label: "💸 Expense",  activeColor: C.red,   activeBg: C.redLight,   activeText: C.redDark   },
            { id: "income",     label: "💰 Income",    activeColor: C.green, activeBg: C.greenLight, activeText: C.greenDark },
            { id: "investment", label: "📈 Invest",    activeColor: C.blue,  activeBg: C.blueLight,  activeText: C.blueDark  },
          ].map(t => (
            <TouchableOpacity
              key={t.id}
              onPress={() => switchType(t.id)}
              style={{
                flex: 1,
                paddingVertical: 13,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: type === t.id ? t.activeColor : C.border,
                backgroundColor: type === t.id ? t.activeBg : C.bgSecondary,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: type === t.id ? "700" : "400", color: type === t.id ? t.activeText : C.textTertiary }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Amount + currency */}
        <View style={[S.rowBetween, { marginBottom: 6 }]}>
          <Text style={S.label}>Amount</Text>
          <TouchableOpacity
            onPress={() => { onCurrencyPickerOpen?.(); setShowCurrencyPicker(true); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: C.greenLight, borderWidth: 0.5, borderColor: C.greenBorder }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: C.greenDark }}>{selectedCurrency}</Text>
            <Text style={{ fontSize: 11, color: C.greenDark }}>▾</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={[S.input, { fontSize: 32, fontFamily: "Courier", fontWeight: "700", textAlign: "center", borderColor: accent }]}
          placeholder="0.00"
          placeholderTextColor={C.textTertiary}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <CurrencyPicker
          visible={showCurrencyPicker}
          selected={selectedCurrency}
          currencyList={currencyList}
          loading={currenciesLoading}
          onSelect={setSelectedCurrency}
          onClose={() => setShowCurrencyPicker(false)}
        />

        {/* Necessity — expense only */}
        {type === "expense" && (
          <>
            <Text style={[S.label, { marginBottom: 8 }]}>Type</Text>
            <View style={[S.row, { gap: 8, marginBottom: 20 }]}>
              <TouchableOpacity
                onPress={() => setNecessity("necessary")}
                style={{
                  flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
                  paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5,
                  borderColor: necessity === "necessary" ? C.red : C.border,
                  backgroundColor: necessity === "necessary" ? C.redLight : C.bgSecondary,
                }}
              >
                <Text style={{ fontSize: 20 }}>🔒</Text>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: necessity === "necessary" ? "700" : "500", color: necessity === "necessary" ? C.redDark : C.text }}>
                    Necessary
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textTertiary, marginTop: 1 }}>Can't cut this</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setNecessity("optional")}
                style={{
                  flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
                  paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5,
                  borderColor: necessity === "optional" ? C.amber : C.border,
                  backgroundColor: necessity === "optional" ? C.amberLight : C.bgSecondary,
                }}
              >
                <Text style={{ fontSize: 20 }}>✂️</Text>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: necessity === "optional" ? "700" : "500", color: necessity === "optional" ? C.amberDark : C.text }}>
                    Optional
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textTertiary, marginTop: 1 }}>Could save here</Text>
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Category */}
        <Text style={[S.label, { marginBottom: 8 }]}>Category</Text>
        <CategoryChips
          categories={cats}
          selected={category}
          onSelect={setCategory}
          colorMap={colorMap}
          style={{ marginBottom: 20 }}
        />

        {/* Note */}
        <Text style={[S.label, { marginBottom: 6 }]}>Note (optional)</Text>
        <TextInput
          style={S.input}
          placeholder="What was it for?"
          placeholderTextColor={C.textTertiary}
          value={note}
          onChangeText={setNote}
        />

        {/* Date */}
        <Text style={[S.label, { marginTop: 18, marginBottom: 6 }]}>Date</Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(!showDatePicker)}
          style={{ backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <Text style={{ fontSize: 15, color: C.text }}>
            {new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
          </Text>
          <Text style={{ fontSize: 16, color: C.textTertiary }}>📅</Text>
        </TouchableOpacity>

        {showDatePicker && (
          <View style={{ marginTop: 12 }}>
            <CalendarPicker
              value={date}
              onChange={(d) => { setDate(d); setShowDatePicker(false); }}
              accentColor={accent}
            />
          </View>
        )}

        {flash && (
          <Text style={{ textAlign: "center", fontSize: 14, color: flash.ok ? C.green : C.red, marginBottom: 8, marginTop: 8 }}>
            {flash.msg}
          </Text>
        )}

        <TouchableOpacity
          style={[S.btnPrimary, { backgroundColor: accent }]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={S.btnPrimaryText}>{type === "investment" ? "Add investment" : `Add ${type}`}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}
