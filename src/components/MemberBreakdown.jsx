import { View, Text } from "react-native";
import { useTheme } from "../contexts/ThemeContext.js";
import { formatCurrency } from "../utils/enums.js";

/**
 * Renders a "By member" breakdown list for household views.
 *
 * Props:
 *   breakdown  — array of member objects from the API:
 *                  { userId, name, totalIncome, totalExpenses, totalInvestments, ... }
 *                or pre-aggregated objects (YearOverviewScreen):
 *                  { userId, name, income, expense, invested }
 *   currency   — display currency code (default "EUR")
 *   style      — optional extra style for the outer View
 */
export function MemberBreakdown({ breakdown, currency = "EUR", style }) {
  const { colors: C, styles: S } = useTheme();
  const fmt = (v) => formatCurrency(v, currency);

  if (!breakdown || breakdown.length === 0) return null;

  return (
    <View style={style}>
      {breakdown.map((member) => {
        // Normalise both API shape and pre-aggregated shape
        const name     = member.name;
        const key      = member.userId ?? name;
        const income   = parseFloat(member.totalIncome?.value   ?? member.income   ?? 0);
        const expense  = parseFloat(member.totalExpenses?.value ?? member.expense  ?? 0);
        const invested = parseFloat(member.totalInvestments?.value ?? member.invested ?? 0);

        return (
          <View key={key} style={[S.row, { paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: C.border }]}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.greenLight, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: C.greenDark }}>
                {name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[S.body, { flex: 1, marginLeft: 10 }]}>{name}</Text>
            <View style={{ alignItems: "flex-end" }}>
              {income   > 0 && <Text style={{ fontSize: 12, fontFamily: "Courier", color: C.green }}>+{fmt(income)}</Text>}
              {expense  > 0 && <Text style={{ fontSize: 12, fontFamily: "Courier", color: C.red }}>−{fmt(expense)}</Text>}
              {invested > 0 && <Text style={{ fontSize: 12, fontFamily: "Courier", color: C.blue }}>↗{fmt(invested)}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}
