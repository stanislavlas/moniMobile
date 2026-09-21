import { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { MONTH_SHORT } from "../../src/utils/theme.js";
import { formatCurrency } from "../../src/utils/enums.js";
import { useTheme } from "../../src/contexts/ThemeContext.js";
import { FinancialPillRow } from "../../src/components/FinancialPillRow.jsx";
import { NecessityBreakdown } from "../../src/components/NecessityBreakdown.jsx";
import { MemberBreakdown } from "../../src/components/MemberBreakdown.jsx";

export function YearOverviewScreen({ allEntries, filterMonth, userCurrency, household, showPersonalOnly, getCategoryById, colorMap }) {
  const { colors: C, styles: S } = useTheme();
  const currency = userCurrency || "EUR";
  const fmtAmt = (val) => formatCurrency(val, currency);

  const [selectedYear, setSelectedYear] = useState(() => parseInt(filterMonth.slice(0, 4)));
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => parseInt(filterMonth.slice(5, 7)) - 1);

  const availableYears = useMemo(() => {
    const years = new Set();
    allEntries.forEach(e => { if (e.date) years.add(parseInt(e.date.slice(0, 4))); });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [allEntries]);

  const yearTotals = useMemo(() => {
    const yearEntries = allEntries.filter(e => e.date?.startsWith(`${selectedYear}-`));
    const income     = yearEntries.filter(e => e.type === "income").reduce((s,e)     => s + e.amount, 0);
    const expense    = yearEntries.filter(e => e.type === "expense").reduce((s,e)    => s + e.amount, 0);
    const investment = yearEntries.filter(e => e.type === "investment").reduce((s,e) => s + e.amount, 0);
    return { income, expense, investment, balance: income - expense - investment };
  }, [allEntries, selectedYear]);

  const monthlyData = useMemo(() => {
    return MONTH_SHORT.map((m, i) => {
      const key = `${selectedYear}-${String(i+1).padStart(2,"0")}`;
      const inc = allEntries.filter(e => e.date?.startsWith(key) && e.type==="income").reduce((s,e) => s+e.amount, 0);
      const exp = allEntries.filter(e => e.date?.startsWith(key) && e.type==="expense").reduce((s,e) => s+e.amount, 0);
      const inv = allEntries.filter(e => e.date?.startsWith(key) && e.type==="investment").reduce((s,e) => s+e.amount, 0);
      return { m, inc, exp, inv };
    });
  }, [allEntries, selectedYear]);

  const maxBar = Math.max(...monthlyData.map(d => Math.max(d.inc, d.exp, d.inv)), 1);

  const selectedMonthData = useMemo(() => {
    const data = monthlyData[selectedMonthIndex];
    return { month: MONTH_SHORT[selectedMonthIndex], income: data.inc, expense: data.exp, investment: data.inv, balance: data.inc - data.exp - data.inv };
  }, [monthlyData, selectedMonthIndex]);

  const yearNecessity = useMemo(() => {
    const yearExpenses = allEntries.filter(e => e.date?.startsWith(`${selectedYear}-`) && e.type === "expense");
    const necessary = yearExpenses.filter(e => { const n = e.necessity?.toLowerCase?.(); return n === "necessary" || n === "need" || !e.necessity; }).reduce((s,e) => s + e.amount, 0);
    const optional  = yearExpenses.filter(e => { const n = e.necessity?.toLowerCase?.(); return n === "optional" || n === "want"; }).reduce((s,e) => s + e.amount, 0);
    return { necessary, optional };
  }, [allEntries, selectedYear]);

  const monthNecessity = useMemo(() => {
    const key = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, "0")}`;
    const monthExpenses = allEntries.filter(e => e.date?.startsWith(key) && e.type === "expense");
    const necessary = monthExpenses.filter(e => { const n = e.necessity?.toLowerCase?.(); return n === "necessary" || n === "need" || !e.necessity; }).reduce((s,e) => s + e.amount, 0);
    const optional  = monthExpenses.filter(e => { const n = e.necessity?.toLowerCase?.(); return n === "optional" || n === "want"; }).reduce((s,e) => s + e.amount, 0);
    return { necessary, optional };
  }, [allEntries, selectedYear, selectedMonthIndex]);

  const yearMemberBreakdown = useMemo(() => {
    if (!household) return [];
    const yearEntries = allEntries.filter(e => e.date?.startsWith(`${selectedYear}-`));
    const map = {};
    yearEntries.forEach(e => {
      if (!e.authorName) return;
      if (!map[e.authorName]) map[e.authorName] = { income: 0, expense: 0 };
      if (e.type === "income" || e.type === "expense") map[e.authorName][e.type] += e.amount;
    });
    return Object.entries(map);
  }, [allEntries, selectedYear, household]);

  return (
    <ScrollView style={S.scroll} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>

      {/* Year header */}
      <View style={{ alignItems: "center", marginTop: 20, paddingTop: 24 }}>
        <Text style={{ fontSize: 15, color: C.textTertiary, marginBottom: 6, fontWeight: "600" }}>YEAR OVERVIEW</Text>
        <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>{selectedYear}</Text>
      </View>

      {/* Year scroller */}
      <View style={{ paddingBottom: 16, paddingTop: 12 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 10 }}
        >
          {availableYears.map(year => (
            <TouchableOpacity
              key={year}
              onPress={() => setSelectedYear(year)}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: year === selectedYear ? C.green : C.cardBg,
                marginHorizontal: 4,
                borderWidth: 0.5,
                borderColor: year === selectedYear ? C.green : C.border,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: year === selectedYear ? "#fff" : C.text }}>
                {year}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Annual balance */}
      <View style={{ alignItems: "center", paddingVertical: 20 }}>
        <Text style={[S.label, { marginBottom: 6 }]}>Annual Balance</Text>
        <Text style={[S.h1, { fontSize: 38, color: yearTotals.balance >= 0 ? C.green : C.red, fontFamily: "Courier" }]}>
          {fmtAmt(yearTotals.balance)}
        </Text>
      </View>

      {/* Year pills */}
      <FinancialPillRow
        income={yearTotals.income}
        expense={yearTotals.expense}
        investment={yearTotals.investment}
        currency={currency}
        style={{ marginBottom: 20 }}
      />

      {/* Year necessity breakdown */}
      {yearTotals.expense > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={S.sectionTitle}>Expense breakdown</Text>
          <NecessityBreakdown
            necessary={yearNecessity.necessary}
            optional={yearNecessity.optional}
            total={yearTotals.expense}
            currency={currency}
          />
        </View>
      )}

      {/* Year member breakdown */}
      {yearMemberBreakdown.length > 0 && !showPersonalOnly && (
        <View style={{ marginBottom: 24 }}>
          <Text style={S.sectionTitle}>By member</Text>
          <MemberBreakdown breakdown={yearMemberBreakdown} currency={currency} />
        </View>
      )}

      {/* Monthly bar chart */}
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: 100, marginBottom: 6 }}>
        {monthlyData.map(({ m, inc, exp, inv }, i) => {
          const active = i === selectedMonthIndex;
          return (
            <TouchableOpacity
              key={m}
              style={{ flex: 1, alignItems: "center" }}
              onPress={() => setSelectedMonthIndex(i)}
            >
              <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", width: "90%", gap: 1 }}>
                <View style={{ flex: 1, backgroundColor: C.green, opacity: active ? 1 : 0.3, borderRadius: 2, height: `${(inc/maxBar)*100}%` }} />
                <View style={{ flex: 1, backgroundColor: C.red,   opacity: active ? 1 : 0.3, borderRadius: 2, height: `${(exp/maxBar)*100}%` }} />
                <View style={{ flex: 1, backgroundColor: C.blue,  opacity: active ? 1 : 0.3, borderRadius: 2, height: `${(inv/maxBar)*100}%` }} />
              </View>
              <Text style={{ fontSize: 7, color: active ? C.text : C.textTertiary, marginTop: 3 }}>{m}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={[S.row, { justifyContent: "center", gap: 16, marginBottom: 4 }]}>
        {[{ l: "Income", c: C.green }, { l: "Expenses", c: C.red }, { l: "Invested", c: C.blue }].map(({ l, c }) => (
          <View key={l} style={S.row}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c, marginRight: 5 }} />
            <Text style={{ fontSize: 11, color: C.textTertiary }}>{l}</Text>
          </View>
        ))}
      </View>

      {/* Selected month detail */}
      <View style={{ marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: C.border }}>
        <Text style={{ fontSize: 13, color: C.textTertiary, textAlign: "center", marginBottom: 8, fontWeight: "600" }}>
          {selectedMonthData.month} {selectedYear}
        </Text>

        <View style={{ alignItems: "center", paddingVertical: 12 }}>
          <Text style={[S.label, { marginBottom: 4, fontSize: 12 }]}>Balance</Text>
          <Text style={{ fontSize: 28, fontWeight: "700", color: selectedMonthData.balance >= 0 ? C.green : C.red, fontFamily: "Courier" }}>
            {fmtAmt(selectedMonthData.balance)}
          </Text>
        </View>

        <FinancialPillRow
          income={selectedMonthData.income}
          expense={selectedMonthData.expense}
          investment={selectedMonthData.investment}
          currency={currency}
          style={{ marginBottom: 16 }}
        />

        {selectedMonthData.expense > 0 && (
          <View style={{ marginBottom: 8 }}>
            <Text style={S.sectionTitle}>Expense breakdown</Text>
            <NecessityBreakdown
              necessary={monthNecessity.necessary}
              optional={monthNecessity.optional}
              total={selectedMonthData.expense}
              currency={currency}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}
