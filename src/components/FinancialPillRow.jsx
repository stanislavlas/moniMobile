import { View, Text } from "react-native";
import { useTheme } from "../contexts/ThemeContext.js";
import { formatCurrency } from "../utils/enums.js";

/**
 * Three coloured pill boxes showing Income / Expenses / Invested totals.
 *
 * Props:
 *   income, expense, investment  — numeric totals (investment defaults to 0)
 *   currency                     — display currency code (default "EUR")
 *   style                        — optional extra style for the outer View
 */
export function FinancialPillRow({ income, expense, investment = 0, currency = "EUR", style }) {
  const { colors: C } = useTheme();
  const fmt = (v) => formatCurrency(v, currency);

  const pills = [
    { label: "Income",   val: income,     bg: C.greenLight, color: C.greenDark },
    { label: "Expenses", val: expense,    bg: C.redLight,   color: C.redDark   },
    { label: "Invested", val: investment, bg: C.blueLight,  color: C.blueDark  },
  ];

  return (
    <View style={[{ flexDirection: "row", gap: 10 }, style]}>
      {pills.map(({ label, val, bg, color }) => (
        <View key={label} style={{ flex: 1, backgroundColor: bg, borderRadius: 10, padding: 10 }}>
          <Text style={{ fontSize: 10, color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
            {label}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color, fontFamily: "Courier" }}>
            {fmt(val)}
          </Text>
        </View>
      ))}
    </View>
  );
}
