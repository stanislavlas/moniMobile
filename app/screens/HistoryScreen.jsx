import { useState, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useTheme } from "../../src/contexts/ThemeContext.js";
import { toApiNecessity, formatCurrency, isNecessary, isOptional } from "../../src/utils/enums.js";
import { MONTH_LABELS } from "../../src/utils/theme.js";
import { useMonthEntries } from "../../src/utils/useMonthEntries.js";
import { currentYearMonth } from "../../src/utils/entries.js";
import { MonthScroller } from "../../src/components/MonthScroller.jsx";

const CACHE_PREFIX = "moni_entries_cache_";

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
  const [typeFilter, setTypeFilter]           = useState("all");
  const [necessityFilter, setNecessityFilter] = useState("all");

  const { monthsData, monthCache, hasMoreMonths, loadAllMonths } = useMonthEntries(CACHE_PREFIX, showHousehold, filterMonth);

  const currentData = monthCache[filterMonth] ?? { entries: [], loading: true, error: null };
  const rawEntries  = currentData.entries;
  const loading     = currentData.loading;

  const filtered = useMemo(() => {
    let list = rawEntries;
    if (typeFilter !== "all")      list = list.filter(e => e.type === typeFilter);
    if (necessityFilter !== "all") list = list.filter(e =>
      necessityFilter === "necessary" ? isNecessary(e) : isOptional(e)
    );
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.note?.toLowerCase().includes(q) || getCategoryById(e.categoryId)?.label?.toLowerCase()?.includes(q) === true);
    }
    return list;
  }, [rawEntries, typeFilter, necessityFilter, search, getCategoryById]);

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
        <MonthScroller monthsData={monthsData} filterMonth={filterMonth} onSelect={setFilterMonth} compact style={{ marginBottom: 12 }} hasMore={hasMoreMonths} onLoadMore={loadAllMonths} />

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

        {/* Filters row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          <View style={[S.row, { gap: 6, paddingBottom: 4 }]}>
            {["all","income","expense","investment"].map(t => (
              <TouchableOpacity key={t} onPress={() => setTypeFilter(t)}
                style={[localStyles.chip, typeFilter === t && {
                  backgroundColor: t === "income" ? C.greenLight : t === "expense" ? C.redLight : t === "investment" ? C.blueLight : C.bgTertiary,
                  borderColor:     t === "income" ? C.green      : t === "expense" ? C.red      : t === "investment" ? C.blue      : C.borderMed,
                }]}>
                <Text style={[localStyles.chipText, typeFilter === t && {
                  fontWeight: "600",
                  color: t === "income" ? C.greenDark : t === "expense" ? C.redDark : t === "investment" ? C.blueDark : C.text,
                }]}>
                  {t === "all" ? "All" : t === "income" ? "💰 Income" : t === "expense" ? "💸 Expenses" : "📈 Investments"}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={{ width: 0.5, backgroundColor: C.border, marginHorizontal: 4 }} />

            {typeFilter !== "investment" && ["all","necessary","optional"].map(n => (
              <TouchableOpacity key={n} onPress={() => setNecessityFilter(n)}
                style={[localStyles.chip, necessityFilter === n && {
                  backgroundColor: n === "necessary" ? C.redLight  : n === "optional" ? C.amberLight : C.bgTertiary,
                  borderColor:     n === "necessary" ? C.red       : n === "optional" ? C.amber      : C.borderMed,
                }]}>
                <Text style={[localStyles.chipText, necessityFilter === n && { fontWeight: "600",
                  color: n === "necessary" ? C.redDark : n === "optional" ? C.amberDark : C.text,
                }]}>
                  {n === "all" ? "All types" : n === "necessary" ? "🔒 Necessary" : "✂️ Optional"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

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
            {search || typeFilter !== "all" || necessityFilter !== "all"
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
