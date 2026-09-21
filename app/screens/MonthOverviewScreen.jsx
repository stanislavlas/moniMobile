import { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { MONTH_SHORT, MONTH_LABELS } from "../../src/utils/theme.js";
import { useTheme } from "../../src/contexts/ThemeContext.js";
import { FinancialPillRow } from "../../src/components/FinancialPillRow.jsx";
import { NecessityBreakdown } from "../../src/components/NecessityBreakdown.jsx";
import { MemberBreakdown } from "../../src/components/MemberBreakdown.jsx";
import { formatCurrency } from "../../src/utils/enums.js";

export function MonthOverviewScreen({ entries, allEntries, filterMonth, setFilterMonth, household, getCategoryById, colorMap, showPersonalOnly, userCurrency }) {
  const { colors: C, styles: S } = useTheme();
  const currency = userCurrency || "EUR";
  const fmtAmt = (val) => formatCurrency(val, currency);

  const totals = useMemo(() => {
    const income     = entries.filter(e => e.type === "income").reduce((s,e)     => s + e.amount, 0);
    const expense    = entries.filter(e => e.type === "expense").reduce((s,e)    => s + e.amount, 0);
    const investment = entries.filter(e => e.type === "investment").reduce((s,e) => s + e.amount, 0);
    return { income, expense, investment, balance: income - expense - investment };
  }, [entries]);

  const necessityTotals = useMemo(() => {
    const expenses = entries.filter(e => e.type === "expense");
    const necessary = expenses.filter(e => {
      const n = e.necessity?.toLowerCase?.();
      return n === "necessary" || n === "need" || !e.necessity;
    }).reduce((s,e) => s + e.amount, 0);
    const optional = expenses.filter(e => {
      const n = e.necessity?.toLowerCase?.();
      return n === "optional" || n === "want";
    }).reduce((s,e) => s + e.amount, 0);
    return { necessary, optional };
  }, [entries]);

  const catTotals = useMemo(() => {
    const map = {};
    entries.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0, 10);
  }, [entries]);

  const memberBreakdown = useMemo(() => {
    if (!household) return [];
    const map = {};
    entries.forEach(e => {
      if (!e.authorName) return;
      if (!map[e.authorName]) map[e.authorName] = { income: 0, expense: 0 };
      if (e.type === "income" || e.type === "expense") map[e.authorName][e.type] += e.amount;
    });
    return Object.entries(map);
  }, [entries, household]);

  const monthsData = useMemo(() => {
    const keys = new Set();
    allEntries.forEach(e => { if (e.date) keys.add(e.date.slice(0, 7)); });
    keys.add(new Date().toISOString().slice(0, 7));
    return Array.from(keys)
      .sort((a, b) => b.localeCompare(a))
      .map(key => {
        const d = new Date(key + "-01");
        return { key, month: d.getMonth(), year: d.getFullYear() };
      });
  }, [allEntries]);

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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 10 }}
        >
          {monthsData.map(({ key, month, year }) => {
            const isActive = key === filterMonth;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setFilterMonth(key)}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: isActive ? C.green : C.cardBg,
                  marginHorizontal: 4,
                  borderWidth: 0.5,
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

      {/* Balance */}
      <View style={{ alignItems: "center", paddingVertical: 28 }}>
        <Text style={[S.label, { marginBottom: 6 }]}>Balance</Text>
        <Text style={[S.h1, { fontSize: 42, color: balColor, fontFamily: "Courier" }]}>{fmtAmt(totals.balance)}</Text>
      </View>

      {/* Pills */}
      <FinancialPillRow
        income={totals.income}
        expense={totals.expense}
        investment={totals.investment}
        currency={currency}
        style={{ marginBottom: 16 }}
      />

      {/* Summary bars */}
      <View style={{ marginBottom: 24 }}>
        <Text style={S.sectionTitle}>Summary</Text>
        {(() => {
          const maxAmount  = Math.max(totals.income, totals.expense, totals.investment, 1);
          const incomePct  = (totals.income / maxAmount) * 100;
          const expensePct = (totals.expense / maxAmount) * 100;
          return (
            <>
              {[
                { label: "💰 Income",   pct: incomePct,  val: totals.income,     color: C.green },
                { label: "💳 Expenses", pct: expensePct, val: totals.expense,    color: C.red   },
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
          <NecessityBreakdown
            necessary={necessityTotals.necessary}
            optional={necessityTotals.optional}
            total={totals.expense}
            currency={currency}
          />
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
        <Text style={[S.small, { textAlign: "center", paddingVertical: 40 }]}>No transactions this month</Text>
      )}
    </ScrollView>
  );
}
