import { useState, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useTheme } from "../../src/contexts/ThemeContext.js";
import { toApiNecessity, formatCurrency, isNecessary, isOptional } from "../../src/utils/enums.js";
import { MONTH_LABELS } from "../../src/utils/theme.js";
import { useMonthEntries } from "../../src/utils/useMonthEntries.js";
import { currentYearMonth } from "../../src/utils/entries.js";
import { MonthScroller } from "../../src/components/MonthScroller.jsx";

const CACHE_PREFIX = "moni_entries_cache_";

// Deterministic per-user color palette derived from userId.
const USER_PALETTES = [
  { light: "#ede9fe", border: "#8b5cf6", text: "#5b21b6" },  // violet
  { light: "#fce7f3", border: "#ec4899", text: "#9d174d" },  // pink
  { light: "#ccfbf1", border: "#14b8a6", text: "#0f766e" },  // teal
  { light: "#ffedd5", border: "#f97316", text: "#9a3412" },  // orange
  { light: "#cffafe", border: "#06b6d4", text: "#155e75" },  // cyan
  { light: "#ecfccb", border: "#84cc16", text: "#3f6212" },  // lime
];

function hashUserId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h) % USER_PALETTES.length;
}

function userPalette(userId) {
  return USER_PALETTES[hashUserId(userId)];
}

// Toggle a value in/out of a Set, returning a new Set.
function toggle(set, value) {
  const next = new Set(set);
  next.has(value) ? next.delete(value) : next.add(value);
  return next;
}

export function HistoryScreen({ user, onDelete, onUpdate, household, showPersonalOnly, incomeCategories, expenseCategories, investmentCategories, allCategories, colorMap, getCategoryById, pendingSync }) {
  const { colors: C, styles: S } = useTheme();
  const showHousehold = !!household && !showPersonalOnly;

  // Theme-aware necessity badge styles — defined inside the component so they
  // use the current color tokens and respond correctly to dark/light mode.
  const NECESSITY_STYLE = {
    necessary: { bg: C.redLight,   color: C.redDark,   label: "🔒 Necessary" },
    optional:  { bg: C.amberLight, color: C.amberDark, label: "✂️ Optional"  },
  };

  // Only the entry author can edit or delete their own entries.
  const canModify = (entry) => !!(user && entry.userId === user.userId);

  const [filterMonth, setFilterMonth] = useState(currentYearMonth);
  const [expandedId, setExpandedId]   = useState(null);
  const [search, setSearch]           = useState("");
  // Sets of active values — empty means "show all"
  const [typeFilters, setTypeFilters]           = useState(new Set());
  const [necessityFilters, setNecessityFilters] = useState(new Set());
  const [userFilters, setUserFilters]           = useState(new Set());

  const { monthsData, monthCache, hasMoreMonths, loadMoreMonths } = useMonthEntries(CACHE_PREFIX, showHousehold, filterMonth);

  const currentData = monthCache[filterMonth] ?? { entries: [], loading: true, error: null };
  const rawEntries  = currentData.entries;
  const loading     = currentData.loading;

  const filtered = useMemo(() => {
    let list = rawEntries;
    if (typeFilters.size      > 0) list = list.filter(e => typeFilters.has(e.type));
    if (necessityFilters.size > 0) list = list.filter(e =>
      (necessityFilters.has("necessary") && isNecessary(e)) ||
      (necessityFilters.has("optional")  && isOptional(e))
    );
    if (userFilters.size > 0) list = list.filter(e => userFilters.has(e.userId));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.note?.toLowerCase().includes(q) || getCategoryById(e.categoryId)?.label?.toLowerCase()?.includes(q) === true);
    }
    return list;
  }, [rawEntries, typeFilters, necessityFilters, userFilters, search, getCategoryById]);

  // Unique authors present in the current month — only useful in household mode.
  const authors = useMemo(() => {
    const seen = new Map();
    for (const e of rawEntries) {
      if (e.userId && !seen.has(e.userId)) seen.set(e.userId, e.authorName || e.userId);
    }
    return Array.from(seen.entries()).map(([userId, name]) => ({ userId, name }));
  }, [rawEntries]);

  const hasFilters = typeFilters.size > 0 || necessityFilters.size > 0 || userFilters.size > 0 || search.trim();

  // Whether necessity filter row should be visible (hidden when only investment is selected)
  const onlyInvestment = typeFilters.size > 0 && [...typeFilters].every(t => t === "investment");

  function confirmDelete(entryId, note) {
    const entry = rawEntries.find(e => e.entryId === entryId);
    if (!entry || !canModify(entry)) return;
    Alert.alert("Delete entry", `Delete "${note || "this entry"}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        // Forward entry.date so removeEntry can emit the correct entryEvent,
        // which the useMonthEntries hook will pick up and invalidate the cache.
        onDelete(entryId, entry.date);
      }},
    ]);
  }

  const selectedMonthLabel = useMemo(() => {
    const d = new Date(filterMonth + "-01");
    return `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
  }, [filterMonth]);

  const localStyles = {
    searchRow:     { flexDirection: "row", alignItems: "center", backgroundColor: C.bgSecondary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 0.5, borderColor: C.border },
    chip:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.bgSecondary },
    chipText:      { fontSize: 12, color: C.textTertiary },
    entryRow:      { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
    catIcon:       { width: 40, height: 40, borderRadius: 11, justifyContent: "center", alignItems: "center", flexShrink: 0 },
    amount:        { fontSize: 15, fontFamily: "Courier", fontWeight: "700", flexShrink: 0 },
    deleteBtn:     { alignSelf: "flex-start", borderWidth: 0.5, borderColor: C.red, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
    necessityBtn:  { flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  };

  return (
    <View style={S.screen}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        {/* Title */}
        <Text style={[S.h2, { marginBottom: 10 }]}>History</Text>

        {/* Month scroller */}
        <MonthScroller monthsData={monthsData} filterMonth={filterMonth} onSelect={setFilterMonth} compact style={{ marginBottom: 12 }} hasMore={hasMoreMonths} onLoadMore={loadMoreMonths} />

        {/* Search */}
        <View style={localStyles.searchRow}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
          <TextInput
            style={{ flex: 1, fontSize: 14, color: C.text }}
            placeholder="Search transactions…" placeholderTextColor={C.textTertiary}
            value={search} onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Text style={{ fontSize: 20, color: C.textTertiary }}>×</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Type filter row — each chip is an independent toggle */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          <View style={[S.row, { gap: 6, paddingBottom: 4 }]}>
            {[
              { value: "income",     label: "💰 Income",      activeBg: C.greenLight, activeBorder: C.green,     activeText: C.greenDark },
              { value: "expense",    label: "💸 Expenses",    activeBg: C.redLight,   activeBorder: C.red,       activeText: C.redDark   },
              { value: "investment", label: "📈 Investments", activeBg: C.blueLight,  activeBorder: C.blue,      activeText: C.blueDark  },
            ].map(({ value, label, activeBg, activeBorder, activeText }) => {
              const on = typeFilters.has(value);
              return (
                <TouchableOpacity key={value}
                  onPress={() => {
                    setTypeFilters(t => toggle(t, value));
                    if (value === "investment") setNecessityFilters(new Set());
                  }}
                  style={[localStyles.chip, on && { backgroundColor: activeBg, borderColor: activeBorder }]}
                >
                  <Text style={[localStyles.chipText, on && { fontWeight: "600", color: activeText }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Necessity filter row */}
        {!onlyInvestment && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={[S.row, { gap: 6, paddingBottom: 4 }]}>
              {[
                { value: "necessary", label: "🔒 Necessary", activeBg: C.redLight,   activeBorder: C.red,   activeText: C.redDark   },
                { value: "optional",  label: "✂️ Optional",  activeBg: C.amberLight, activeBorder: C.amber, activeText: C.amberDark },
              ].map(({ value, label, activeBg, activeBorder, activeText }) => {
                const on = necessityFilters.has(value);
                return (
                  <TouchableOpacity key={value}
                    onPress={() => setNecessityFilters(n => toggle(n, value))}
                    style={[localStyles.chip, on && { backgroundColor: activeBg, borderColor: activeBorder }]}
                  >
                    <Text style={[localStyles.chipText, on && { fontWeight: "600", color: activeText }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Member filter row — only shown when multiple authors are present in this month */}
        {authors.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={[S.row, { gap: 6, paddingBottom: 4 }]}>
              {authors.map(({ userId, name }) => {
                const p  = userPalette(userId);
                const on = userFilters.has(userId);
                return (
                  <TouchableOpacity
                    key={userId}
                    onPress={() => setUserFilters(u => toggle(u, userId))}
                    style={[localStyles.chip, on && { backgroundColor: p.light, borderColor: p.border }]}
                  >
                    <Text style={[localStyles.chipText, on && { fontWeight: "600", color: p.text }]}>
                      {userId === user?.userId ? `${name} (you)` : name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        <View style={[S.divider, { marginTop: 10, marginBottom: 4 }]} />
        <Text style={[S.small, { paddingVertical: 6 }]}>
          {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}{loading ? " (loading…)" : ""}
        </Text>
        <View style={S.divider} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {loading && !rawEntries.length ? (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <ActivityIndicator color={C.green} />
          </View>
        ) : filtered.length === 0 ? (
          <Text style={[S.small, { textAlign: "center", paddingVertical: 48 }]}>
            {hasFilters
              ? "No matching transactions"
              : `No transactions in ${selectedMonthLabel}`}
          </Text>
        ) : filtered.map(entry => {
          const cat      = getCategoryById(entry.categoryId);
          const color    = colorMap[entry.categoryId] || "#888";
          const expanded = expandedId === entry.entryId;
          const ns       = NECESSITY_STYLE[entry.necessity || "necessary"];

          return (
            <View key={entry.entryId} style={{ borderBottomWidth: 0.5, borderBottomColor: C.border }}>
              <TouchableOpacity
                style={localStyles.entryRow}
                onPress={() => setExpandedId(expanded ? null : entry.entryId)}
                activeOpacity={0.7}
              >
                <View style={[localStyles.catIcon, { backgroundColor: color + "20" }]}>
                  <Text style={{ fontSize: 18 }}>{cat.emoji}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={[S.row, { gap: 6 }]}>
                    <Text style={[S.body, { fontWeight: "500", flexShrink: 1 }]} numberOfLines={1}>
                      {entry.note || cat.label}
                    </Text>
                    {entry.type === "expense" && (
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: ns.bg }}>
                        <Text style={{ fontSize: 10, color: ns.color }}>
                          {entry.necessity === "optional" ? "✂️" : "🔒"}
                        </Text>
                      </View>
                    )}
                    {pendingSync?.has(entry.entryId) && (
                      <View style={{ paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, backgroundColor: C.amberLight, borderWidth: 0.5, borderColor: C.amberBorder }}>
                        <Text style={{ fontSize: 9, color: C.amberDark, fontWeight: "600" }}>PENDING</Text>
                      </View>
                    )}
                  </View>
                  <Text style={S.small}>
                    {cat.label} · {entry.date?.slice(5).replace("-","/")}
                    {entry.authorName ? (
                      <Text style={entry.userId !== user?.userId ? { fontWeight: "600", color: C.textSecondary } : {}}>
                        {` · ${entry.authorName}`}
                      </Text>
                    ) : null}
                  </Text>
                </View>
                <Text style={[localStyles.amount, { color: entry.type === "income" ? C.green : entry.type === "investment" ? C.blue : C.red }]}>
                  {entry.type === "income" ? "+" : entry.type === "investment" ? "+" : "−"}{formatCurrency(entry.amount, entry.currency || user?.currency)}
                </Text>
              </TouchableOpacity>

              {expanded && (
                <View style={{ paddingLeft: 52, paddingBottom: 14 }}>
                  {canModify(entry) ? (
                    <>
                      {entry.type === "expense" && (
                        <View style={{ marginBottom: 12 }}>
                          <Text style={[S.label, { marginBottom: 8 }]}>Mark as</Text>
                          <View style={[S.row, { gap: 8 }]}>
                            {["necessary","optional"].map(n => {
                              const active = (entry.necessity || "necessary") === n;
                              const nstyle = NECESSITY_STYLE[n];
                              return (
                                <TouchableOpacity key={n} onPress={() => onUpdate({ ...entry, necessity: toApiNecessity(n) })}
                                  style={[localStyles.necessityBtn, active && { backgroundColor: nstyle.bg, borderColor: n === "necessary" ? C.red : C.amber }]}>
                                  <Text style={{ fontSize: 12, color: active ? nstyle.color : C.textTertiary, fontWeight: active ? "600" : "400" }}>
                                    {nstyle.label}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      )}

                      <Text style={[S.label, { marginBottom: 8 }]}>Change category</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                        {(entry.type === "income" ? incomeCategories : entry.type === "investment" ? investmentCategories : expenseCategories).map(c => {
                          const cId   = c.id || c.categoryId;
                          const active = entry.categoryId === cId;
                          const cc    = colorMap[cId] || "#888";
                          return (
                            <TouchableOpacity key={cId} onPress={async () => {
                              await onUpdate({ ...entry, categoryId: cId });
                              setExpandedId(null);
                            }} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 0.5, borderColor: active ? cc : C.border, backgroundColor: active ? cc + "20" : C.bgSecondary }}>
                              <Text style={{ fontSize: 12, color: active ? cc : C.textSecondary }}>{c.emoji} {c.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <TouchableOpacity onPress={() => confirmDelete(entry.entryId, entry.note)} style={localStyles.deleteBtn}>
                        <Text style={{ fontSize: 12, color: C.red }}>Delete</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={[S.small, { color: C.textTertiary, fontStyle: "italic" }]}>
                      Added by {entry.authorName || "another member"}
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
