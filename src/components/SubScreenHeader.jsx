import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../contexts/ThemeContext.js";

/**
 * Header bar for sub-screens inside AccountScreen.
 * Shows a circular back button on the left and a title.
 *
 * Props:
 *   title    — string shown as the heading
 *   onBack   — called when the back button is pressed
 */
export function SubScreenHeader({ title, onBack }) {
  const { colors: C, styles: S } = useTheme();

  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 0.5,
      borderBottomColor: C.border,
      backgroundColor: C.bg,
    }}>
      <TouchableOpacity
        onPress={onBack}
        style={{
          marginRight: 12,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: C.green,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <Text style={{ fontSize: 18, color: "#fff", fontWeight: "bold" }}>◀</Text>
      </TouchableOpacity>
      <Text style={S.h3}>{title}</Text>
    </View>
  );
}
