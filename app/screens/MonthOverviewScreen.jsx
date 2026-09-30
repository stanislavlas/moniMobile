import { useMemo } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { MONTH_LABELS } from "../../src/utils/theme.js";
import { useTheme } from "../../src/contexts/ThemeContext.js";
import { FinancialPillRow } from "../../src/components/FinancialPillRow.jsx";
import { NecessityBreakdown } from "../../src/components/NecessityBreakdown.jsx";
import { MemberBreakdown } from "../../src/components/MemberBreakdown.jsx";
import { MonthScroller } from "../../src/components/MonthScroller.jsx";
import { formatCurrency } from "../../src/utils/enums.js";
import { useDashboard } from "../../src/utils/useDashboard.js";

const CACHE_PREFIX = "moni_dashboard_cache_";

export function MonthOverviewScreen({ filterMonth, setFilterMonth, household, getCategoryById, colorMap, showPersonalOnly, userCurrency, pendingSync }) {
  const { colors: C, styles: S } = useTheme();
  const currency = userCurrency || "EUR";
  const fmtAmt = (val) => formatCurrency(val, currency);
  const showHousehold = !!household && !showPersonalOnly;

  const { monthsData, dashboardCache } = useDashboard(CACHE_PREFIX, showHousehold, filterMonth);

  const currentData = dashboardCache[filterMonth] ?? { data: null, loading: true, error: null };
  const dash    = currentData.data;
  const loading = currentData.loading;

  // Pre-computed totals from the API — no client-side summation needed
  const income     = parseFloat(dash?.totalIncome?.value      ?? 0);
  const expense    = parseFloat(dash?.totalExpenses?.value    ?? 0);
  const investment = parseFloat(dash?.totalInvestments?.value ?? 0);
  const balance    = parseFloat(dash?.savedAmount?.value      ?? 0);
  const necessary  = parseFloat(dash?.necessaryVsOptional?.necessary?.value ?? 0);
  const optional   = parseFloat(dash?.necessaryVsOptional?.optional?.value  ?? 0);

  // memberBreakdown is pre-computed by the API in household mode; null in personal mode
  const memberBreakdown = dash?.memberBreakdown ?? [];

  // Category breakdown from API — map categoryId → { value } to display list
  const catTotals = useMemo(() => {
    if (!dash?.expensesByCategory) return [];
    return Object.entries(dash.expensesByCategory)
      .map(([catId, amount]) => [catId, parseFloat(amount.value ?? 0)])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [dash]);

  const selectedMonthLabel = useMemo(() => {
    const d = new Date(filterMonth + "-01");
    return `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
  }, [filterMonth]);

  const balColor = balance >= 0 ? C.green : C.red;

  return (
    <ScrollView style={S.scroll} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>

      {/* Header */}
      <View style={{ paddingTop: 20, paddingBottom: 10, alignItems: "center" }}>
        <Text style={{ fontSize: 15, color: C.textTertiary, marginBottom: 6, fontWeight: "600" }}>MONTH OVERVIEW</Text>
        <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>{selectedMonthLabel}</Text>
      </View>

      {/* Month scroller */}
      <View style={{ paddingBottom: 20 }}>
        <MonthScroller monthsData={monthsData} filterMonth={filterMonth} onSelect={setFilterMonth} />
      </View>

      {loading && !dash && (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <ActivityIndicator color={C.green} />
        </View>
      )}

      {/* Pending sync indicator */}
      {pendingSync?.size > 0 && (
        <View style={{ marginBottom: 10, paddingHorizontal: 4, alignSelf: "flex-start" }}>
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: C.amberLight, borderWidth: 0.5, borderColor: C.amberBorder }}>
            <Text style={{ fontSize: 11, color: C.amberDark, fontWeight: "600" }}>{pendingSync.size} PENDING SYNC</Text>
          </View>
        </View>
      )}

      {/* Balance */}
      <View style={{ alignItems: "center", paddingVertical: 28 }}>
        <Text style={[S.label, { marginBottom: 6 }]}>Balance</Text>
        <Text style={[S.h1, { fontSize: 42, color: balColor, fontFamily: "Courier" }]}>{fmtAmt(balance)}</Text>
      </View>

      {/* Pills */}
      <FinancialPillRow income={income} expense={expense} investment={investment} currency={currency} style={{ marginBottom: 16 }} />

      {/* Summary bars */}
      <View style={{ marginBottom: 24 }}>
        <Text style={S.sectionTitle}>Summary</Text>
        {(() => {
          const maxAmount = Math.max(income, expense, investment, 1);
          return (
            <>
              {[
                { label: "💰 Income",   pct: (income     / maxAmount) * 100, val: income,     color: C.green },
                { label: "💳 Expenses", pct: (expense    / maxAmount) * 100, val: expense,    color: C.red   },
                ...(investment > 0 ? [{ label: "📈 Invested", pct: (investment / maxAmount) * 100, val: investment, color: C.blue }] : []),
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
      {expense > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={S.sectionTitle}>Expense breakdown</Text>
          <NecessityBreakdown necessary={necessary} optional={optional} total={expense} currency={currency} />
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
