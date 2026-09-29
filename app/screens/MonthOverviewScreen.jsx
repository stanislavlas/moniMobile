import { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { MONTH_SHORT, MONTH_LABELS } from "../../src/utils/theme.js";
import { useTheme } from "../../src/contexts/ThemeContext.js";
import { FinancialPillRow } from "../../src/components/FinancialPillRow.jsx";
import { NecessityBreakdown } from "../../src/components/NecessityBreakdown.jsx";
import { MemberBreakdown } from "../../src/components/MemberBreakdown.jsx";
import { formatCurrency } from "../../src/utils/enums.js";
import { useMonthEntries } from "../../src/utils/useMonthEntries.js";

const CACHE_PREFIX = "moni_entries_cache_";

export function MonthOverviewScreen({ filterMonth, setFilterMonth, household, getCategoryById, colorMap, showPersonalOnly, userCurrency, pendingSync }) {
  const { colors: C, styles: S } = useTheme();
  const currency = userCurrency || "EUR";
  const fmtAmt = (val) => formatCurrency(val, currency);
  const showHousehold = !!household && !showPersonalOnly;

  const { monthsData, monthCache } = useMonthEntries(CACHE_PREFIX, showHousehold, filterMonth);

  const currentData = monthCache[filterMonth] ?? { entries: [], loading: true, error: null };
  const entries     = currentData.entries;
  const loading     = currentData.loading;

  const totals = useMemo(() => {
    const income     = entries.filter(e => e.type === "income").reduce((s,e)     => s + e.amount, 0);
    const expense    = entries.filter(e => e.type === "expense").reduce((s,e)    => s + e.amount, 0);
    const investment = entries.filter(e => e.type === "investment").reduce((s,e) => s + e.amount, 0);
    return { income, expense, investment, balance: income - expense - investment };
  }, [entries]);

  const necessityTotals = useMemo(() => {
    const expenses = entries.filter(e => e.type === "expense");
    return {
      necessary: expenses.filter(e => e.necessity === "necessary").reduce((s,e) => s + e.amount, 0),
      optional:  expenses.filter(e => e.necessity === "optional").reduce((s,e) => s + e.amount, 0),
    };
  }, [entries]);

  const catTotals = useMemo(() => {
    const map = {};
    entries.forEach(e => { if (e.categoryId) map[e.categoryId] = (map[e.categoryId] || 0) + e.amount; });
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0, 10);
  }, [entries]);

  const memberBreakdown = useMemo(() => {
    if (!household) return [];
    const map = {};
    entries.forEach(e => {
      if (!e.authorName) return;
      if (!map[e.authorName]) map[e.authorName] = { income: 0, expense: 0, invested: 0 };
      if (e.type === "income")     map[e.authorName].income   += e.amount;
      if (e.type === "expense")    map[e.authorName].expense  += e.amount;
      if (e.type === "investment") map[e.authorName].invested += e.amount;
    });
    return Object.entries(map);
  }, [entries, household]);

  const selectedMonthLabel = useMemo(() => {
    const d = new Date(filterMonth + "-01");
    return `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
  }, [filterMonth]);

  const balColor = totals.balance >= 0 ? C.green : C.red;

  return (
    <ScrollView style={S.scroll} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>

      {/* Header */}
      <View style={{ paddingTop: 20, paddingBottom: 10, alignItems: "center" }}>
        <Text style={{ fontSize: 15, color: C.textTertiary, marginBottom: 6, fontWeight: "600" }}>MONTH OVERVIEW</Text>
        <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>{selectedMonthLabel}</Text>
      </View>

      {/* Month scroller */}
      <View style={{ paddingBottom: 20 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10 }}>
          {monthsData.map(({ key, month, year }) => {
            const isActive = key === filterMonth;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setFilterMonth(key)}
                style={{
                  paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10,
                  backgroundColor: isActive ? C.green : C.cardBg,
                  marginHorizontal: 4, borderWidth: 0.5,
                  borderColor: isActive ? C.green : C.border,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: isActive ? "#fff" : C.text, marginBottom: 2 }}>
                  {MONTH_SHORT[month]}
                </Text>
                <Text style={{ fontSize: 11, color: isActive ? "#fff" : C.textTertiary, fontWeight: isActive ? "700" : "400" }}>
                  {year}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading && !entries.length && (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <ActivityIndicator color={C.green} />
        </View>
      )}

      {/* Pending sync indicator */}
      {pendingSync?.size > 0 && (
        <View style={{ marginBottom: 10, paddingHorizontal: 4, alignSelf: "flex-start" }}>
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: "#FFF3CD", borderWidth: 0.5, borderColor: "#FAC775" }}>
            <Text style={{ fontSize: 11, color: "#854F0B", fontWeight: "600" }}>{pendingSync.size} PENDING SYNC</Text>
          </View>
        </View>
      )}

      {/* Balance */}
      <View style={{ alignItems: "center", paddingVertical: 28 }}>
        <Text style={[S.label, { marginBottom: 6 }]}>Balance</Text>
        <Text style={[S.h1, { fontSize: 42, color: balColor, fontFamily: "Courier" }]}>{fmtAmt(totals.balance)}</Text>
      </View>

      {/* Pills */}
      <FinancialPillRow income={totals.income} expense={totals.expense} investment={totals.investment} currency={currency} style={{ marginBottom: 16 }} />

      {/* Summary bars */}
      <View style={{ marginBottom: 24 }}>
        <Text style={S.sectionTitle}>Summary</Text>
        {(() => {
          const maxAmount  = Math.max(totals.income, totals.expense, totals.investment, 1);
          return (
            <>
              {[
                { label: "💰 Income",   pct: (totals.income / maxAmount) * 100,     val: totals.income,     color: C.green },
                { label: "💳 Expenses", pct: (totals.expense / maxAmount) * 100,    val: totals.expense,    color: C.red   },
                ...(totals.investment > 0 ? [{ label: "📈 Invested", pct: (totals.investment / maxAmount) * 100, val: totals.investment, color: C.blue }] : []),
              ].map(({ label, pct, val, color }) => (
                <View key={label} style={{ marginBottom: 12 }}>
                  <View style={S.rowBetween}>
                    <Text style={[S.body, { flex: 1 }]}>{label}</Text>
                    <Text style={{ fontSize: 13, fontFamily: "Courier", color: C.textSecondary }}>{fmtAmt(val)}</Text>
                  </View>
                  <View style={{ height: 5, borderRadius: 3, backgroundColor: C.bgTertiary, marginTop: 5, overflow: "hidden" }}>
                    <View style={{ height: "100%", borderRadius: 3, width: `${pct}%`, backgroundColor: color }} />
                  </View>
                </View>
              ))}
            </>
          );
        })()}
      </View>

      {/* Necessity breakdown */}
      {totals.expense > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={S.sectionTitle}>Expense breakdown</Text>
          <NecessityBreakdown necessary={necessityTotals.necessary} optional={necessityTotals.optional} total={totals.expense} currency={currency} />
        </View>
      )}

      {/* Member breakdown */}
      {memberBreakdown.length > 0 && !showPersonalOnly && (
        <View style={{ marginBottom: 24 }}>
          <Text style={S.sectionTitle}>By member</Text>
          <MemberBreakdown breakdown={memberBreakdown} currency={currency} />
        </View>
      )}

      {/* Category bars */}
      {catTotals.length > 0 ? (
        <View style={{ marginBottom: 28 }}>
          <Text style={S.sectionTitle}>By category</Text>
          {catTotals.map(([catId, amt]) => {
            const cat   = getCategoryById(catId);
            const color = colorMap[catId] || "#888";
            const pct   = amt / catTotals[0][1];
            return (
              <View key={catId} style={{ marginBottom: 12 }}>
                <View style={S.rowBetween}>
                  <Text style={[S.body, { flex: 1 }]}>{cat.emoji} {cat.label}</Text>
                  <Text style={{ fontSize: 13, fontFamily: "Courier", color: C.textSecondary }}>{fmtAmt(amt)}</Text>
                </View>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: C.bgTertiary, marginTop: 5, overflow: "hidden" }}>
                  <View style={{ height: "100%", borderRadius: 3, width: `${pct * 100}%`, backgroundColor: color }} />
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        !loading && <Text style={[S.small, { textAlign: "center", paddingVertical: 40 }]}>No transactions this month</Text>
      )}
    </ScrollView>
  );
}
