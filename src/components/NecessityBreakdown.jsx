import { View, Text } from "react-native";
import { useTheme } from "../contexts/ThemeContext.js";
import { formatCurrency } from "../utils/enums.js";

/**
 * Necessary vs. Optional expense breakdown card with a split progress bar.
 *
 * Props:
 *   necessary   — necessary expenses total
 *   optional    — optional expenses total
 *   total       — total expenses (used for percentage calculations)
 *   currency    — display currency code (default "EUR")
 *   style       — optional extra style for the outer View
 */
export function NecessityBreakdown({ necessary, optional, total, currency = "EUR", style }) {
  const { colors: C } = useTheme();
  const fmt = (v) => formatCurrency(v, currency);

  if (!total || total <= 0) return null;

  return (
    <View style={style}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {/* Necessary */}
        <View style={{ flex: 1, backgroundColor: C.redLight, borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: C.redBorder }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
            <Text style={{ fontSize: 12 }}>🔒</Text>
            <Text style={{ fontSize: 10, color: C.redDark, textTransform: "uppercase", letterSpacing: 0.5, flex: 1, marginLeft: 4 }}>
              Necessary
            </Text>
            <Text style={{ fontSize: 10, color: C.red, fontWeight: "600" }}>
              {Math.round((necessary / total) * 100)}%
            </Text>
          </View>
          <Text style={{ fontSize: 13, fontWeight: "700", fontFamily: "Courier", color: C.redDark }}>
            {fmt(necessary)}
          </Text>
        </View>

        {/* Optional */}
        <View style={{ flex: 1, backgroundColor: C.amberLight, borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: C.amberBorder }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
            <Text style={{ fontSize: 12 }}>✂️</Text>
            <Text style={{ fontSize: 10, color: C.amberDark, textTransform: "uppercase", letterSpacing: 0.5, flex: 1, marginLeft: 4 }}>
              Optional
            </Text>
            <Text style={{ fontSize: 10, color: C.amberText, fontWeight: "600" }}>
              {Math.round((optional / total) * 100)}%
            </Text>
          </View>
          <Text style={{ fontSize: 13, fontWeight: "700", fontFamily: "Courier", color: C.amberDark }}>
            {fmt(optional)}
          </Text>
        </View>
      </View>

      {/* Split progress bar */}
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.bgTertiary, marginTop: 10, overflow: "hidden", flexDirection: "row" }}>
        <View style={{ flex: necessary, backgroundColor: C.red,   opacity: 0.8 }} />
        <View style={{ flex: optional,  backgroundColor: C.amber, opacity: 0.8 }} />
      </View>
    </View>
  );
}
