import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { MONTH_SHORT } from "../../src/utils/theme.js";
import { formatCurrency } from "../../src/utils/enums.js";
import { useTheme } from "../../src/contexts/ThemeContext.js";
import { FinancialPillRow } from "../../src/components/FinancialPillRow.jsx";
import { NecessityBreakdown } from "../../src/components/NecessityBreakdown.jsx";
import { MemberBreakdown } from "../../src/components/MemberBreakdown.jsx";
import { getYearDashboard } from "../../src/services/dashboard.js";
import { listActiveYears } from "../../src/services/entries.js";
import { entryEvents } from "../../src/utils/entryEvents.js";
import { logger } from "../../src/utils/logger.js";

export function YearOverviewScreen({ filterMonth, userCurrency, household, showPersonalOnly, getCategoryById, colorMap }) {
  const { colors: C, styles: S } = useTheme();
  const currency = userCurrency || "EUR";
  const fmtAmt = (val) => formatCurrency(val, currency);

  // currentYear is memoized with [] so it's computed once and stays stable,
  // preventing unnecessary re-runs of effects that list it as a dependency.
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [selectedYear, setSelectedYear] = useState(() => parseInt(filterMonth.slice(0, 4)));
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => parseInt(filterMonth.slice(5, 7)) - 1);

  // Keep selected year/month in sync when the parent's filterMonth changes
  useEffect(() => {
    setSelectedYear(parseInt(filterMonth.slice(0, 4)));
    setSelectedMonthIndex(parseInt(filterMonth.slice(5, 7)) - 1);
  }, [filterMonth]);

  // Year cache: { [year]: { data: YearDashboardResponse | null, loading, error } }
  const [yearCache, setYearCache] = useState({});
  // Mirror the cache in a ref so fetchYear can guard against duplicate fetches
  // without needing yearCache in its useCallback deps (which would cause an
  // infinite re-render loop: setYearCache → new yearCache → new fetchYear →
  // useEffect fires → fetchYear called → setYearCache → …).
  const yearCacheRef = useRef({});
  const [activeYears, setActiveYears] = useState([currentYear]);
  const showHousehold = !!household && !showPersonalOnly;

  // Fetch distinct years that have data; always include current year
  useEffect(() => {
    let cancelled = false;
    listActiveYears(showHousehold)
      .then(data => {
        if (cancelled) return;
        const all = new Set([currentYear, ...(Array.isArray(data) ? data : [])]);
        setActiveYears([...all].sort((a, b) => b - a));
      })
      .catch(() => { /* keep seed */ });
    return () => { cancelled = true; };
  }, [showHousehold, currentYear]);

  // Fetch the full year in one request.
  // yearCache is intentionally NOT in the deps array — the ref guards against
  // duplicate fetches, keeping fetchYear stable and preventing infinite loops.
  const fetchYear = useCallback((y, force = false) => {
    if (!force && yearCacheRef.current[y]?.data) return;
    setYearCache(prev => {
      const next = { ...prev, [y]: { data: null, loading: true, error: null } };
      yearCacheRef.current = next;
      return next;
    });
    logger.info("dashboard", `YearOverview fetchYear: ${y}`);
    getYearDashboard(y, showHousehold)
      .then(data => setYearCache(prev => {
        const next = { ...prev, [y]: { data, loading: false, error: null } };
        yearCacheRef.current = next;
        return next;
      }))
      .catch(err => {
        logger.error("dashboard", `YearOverview fetchYear error: ${y}`, err.message);
        setYearCache(prev => {
          const next = { ...prev, [y]: { data: null, loading: false, error: err.message } };
          yearCacheRef.current = next;
          return next;
        });
      });
  }, [showHousehold]);

  // Reset on household toggle — declared BEFORE the fetch effect so React
  // runs this cleanup first, preventing stale data from briefly appearing.
  useEffect(() => {
    yearCacheRef.current = {};
    setYearCache({});
    setActiveYears([currentYear]);
  }, [showHousehold, currentYear]);

  // Fetch on year or household change (runs after the reset effect above)
  useEffect(() => { fetchYear(selectedYear); }, [selectedYear, fetchYear]);

  // Invalidate year when entries are mutated
  useEffect(() => {
    return entryEvents.subscribe(date => {
      if (!date) {
        yearCacheRef.current = {};
        setYearCache({});
        return;
      }
      const affectedYear = parseInt(date.slice(0, 4), 10);
      setYearCache(prev => {
        if (!prev[affectedYear]) return prev;
        const next = { ...prev };
        delete next[affectedYear];
        yearCacheRef.current = next;
        return next;
      });
      setActiveYears(prev =>
        prev.includes(affectedYear) ? prev : [...prev, affectedYear].sort((a, b) => b - a)
      );
      if (affectedYear === selectedYear) fetchYear(selectedYear, true);
    });
  }, [selectedYear, fetchYear]);

  const cached   = yearCache[selectedYear] ?? { data: null, loading: true, error: null };
  const yearData = cached.data;
  const loading  = cached.loading;

  // Build 12-month display array from the single response
  const monthlyData = useMemo(() =>
    MONTH_SHORT.map((m, i) => {
      const mo   = String(i + 1).padStart(2, "0");
      const ym   = `${selectedYear}-${mo}`;
      const ms   = yearData?.months?.[ym] ?? null;
      return {
        m,
        ym,
        inc: parseFloat(ms?.totalIncome?.value      ?? 0),
        exp: parseFloat(ms?.totalExpenses?.value    ?? 0),
        inv: parseFloat(ms?.totalInvestments?.value ?? 0),
        necessary: parseFloat(ms?.necessaryVsOptional?.necessary?.value ?? 0),
        optional:  parseFloat(ms?.necessaryVsOptional?.optional?.value  ?? 0),
      };
    }),
  [selectedYear, yearData]);

  // Annual totals — read directly from API yearTotals
  const yt         = yearData?.yearTotals;
  const yearTotals = {
    income:     parseFloat(yt?.totalIncome?.value      ?? 0),
    expense:    parseFloat(yt?.totalExpenses?.value    ?? 0),
    investment: parseFloat(yt?.totalInvestments?.value ?? 0),
  };
  const yearBalance  = parseFloat(yt?.savedAmount?.value ?? 0);
  const yearNecessity = {
    necessary: parseFloat(yt?.necessaryVsOptional?.necessary?.value ?? 0),
    optional:  parseFloat(yt?.necessaryVsOptional?.optional?.value  ?? 0),
  };
  const yearMemberBreakdown = yt?.memberBreakdown ?? [];

  const maxBar = Math.max(...monthlyData.map(d => Math.max(d.inc, d.exp, d.inv)), 1);

  const selData    = monthlyData[selectedMonthIndex];
  const selBalance = (selData?.inc ?? 0) - (selData?.exp ?? 0) - (selData?.inv ?? 0);

  return (
    <ScrollView style={S.scroll} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>

      {/* Year header */}
      <View style={{ alignItems: "center", marginTop: 20, paddingTop: 24 }}>
        <Text style={{ fontSize: 15, color: C.textTertiary, marginBottom: 6, fontWeight: "600" }}>YEAR OVERVIEW</Text>
        <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>{selectedYear}</Text>
      </View>

      {/* Year scroller */}
      <View style={{ paddingBottom: 16, paddingTop: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10 }}>
          {activeYears.map(year => (
            <TouchableOpacity
              key={year}
              onPress={() => setSelectedYear(year)}
              style={{
                paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10,
                backgroundColor: year === selectedYear ? C.green : C.cardBg,
                marginHorizontal: 4, borderWidth: 0.5,
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

      {loading ? (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <ActivityIndicator color={C.green} />
        </View>
      ) : (
        <>
          {/* Annual balance */}
          <View style={{ alignItems: "center", paddingVertical: 20 }}>
            <Text style={[S.label, { marginBottom: 6 }]}>Annual Balance</Text>
            <Text style={[S.h1, { fontSize: 38, color: yearBalance >= 0 ? C.green : C.red, fontFamily: "Courier" }]}>
              {fmtAmt(yearBalance)}
            </Text>
          </View>

          <FinancialPillRow income={yearTotals.income} expense={yearTotals.expense} investment={yearTotals.investment} currency={currency} style={{ marginBottom: 20 }} />

          {yearTotals.expense > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={S.sectionTitle}>Expense breakdown</Text>
              <NecessityBreakdown necessary={yearNecessity.necessary} optional={yearNecessity.optional} total={yearTotals.expense} currency={currency} />
            </View>
          )}

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
                <TouchableOpacity key={m} style={{ flex: 1, alignItems: "center" }} onPress={() => setSelectedMonthIndex(i)}>
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
          {selData && (
            <View style={{ marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: C.border }}>
              <Text style={{ fontSize: 13, color: C.textTertiary, textAlign: "center", marginBottom: 8, fontWeight: "600" }}>
                {selData.m} {selectedYear}
              </Text>
              <View style={{ alignItems: "center", paddingVertical: 12 }}>
                <Text style={[S.label, { marginBottom: 4, fontSize: 12 }]}>Balance</Text>
                <Text style={{ fontSize: 28, fontWeight: "700", color: selBalance >= 0 ? C.green : C.red, fontFamily: "Courier" }}>
                  {fmtAmt(selBalance)}
                </Text>
              </View>
              <FinancialPillRow income={selData.inc} expense={selData.exp} investment={selData.inv} currency={currency} style={{ marginBottom: 16 }} />
              {selData.exp > 0 && (
                <View style={{ marginBottom: 8 }}>
                  <Text style={S.sectionTitle}>Expense breakdown</Text>
                  <NecessityBreakdown necessary={selData.necessary} optional={selData.optional} total={selData.exp} currency={currency} />
                </View>
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
