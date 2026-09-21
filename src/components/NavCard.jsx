import { TouchableOpacity, View, Text } from "react-native";
import { useTheme } from "../contexts/ThemeContext.js";

/**
 * A tappable card row used for in-app navigation.
 * Shows an emoji icon, a label, and a trailing arrow.
 *
 * Props:
 *   emoji    — emoji string for the left icon
 *   label    — text label
 *   onPress  — press handler
 *   style    — optional extra style for the card
 */
export function NavCard({ emoji, label, onPress, style }) {
  const { colors: C, styles: S } = useTheme();

  return (
    <TouchableOpacity
      style={[S.card, { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }, style]}
      onPress={onPress}
    >
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
      <Text style={[S.body, { fontWeight: "600", flex: 1 }]}>{label}</Text>
      <Text style={{ fontSize: 18, color: C.textTertiary }}>→</Text>
    </TouchableOpacity>
  );
}
