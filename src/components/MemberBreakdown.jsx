import { View, Text } from "react-native";
import { useTheme } from "../contexts/ThemeContext.js";
import { formatCurrency } from "../utils/enums.js";

/**
 * Renders a "By member" breakdown list for household views.
 *
 * Props:
 *   breakdown  — array of [name, { income, expense, invested }] tuples
 *   currency   — display currency code (default "EUR")
 *   style      — optional extra style for the outer View
 */
export function MemberBreakdown({ breakdown, currency = "EUR", style }) {
  const { colors: C, styles: S } = useTheme();
  const fmt = (v) => formatCurrency(v, currency);

  if (!breakdown || breakdown.length === 0) return null;

  return (
    <View style={style}>
      {breakdown.map(([name, t]) => (
        <View key={name} style={[S.row, { paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: C.border }]}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.greenLight, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.greenDark }}>
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[S.body, { flex: 1, marginLeft: 10 }]}>{name}</Text>
          <View style={{ alignItems: "flex-end" }}>
            {t.income   > 0 && <Text style={{ fontSize: 12, fontFamily: "Courier", color: C.green }}>+{fmt(t.income)}</Text>}
            {t.expense  > 0 && <Text style={{ fontSize: 12, fontFamily: "Courier", color: C.red }}>−{fmt(t.expense)}</Text>}
            {t.invested > 0 && <Text style={{ fontSize: 12, fontFamily: "Courier", color: C.blue }}>↗{fmt(t.invested)}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}
