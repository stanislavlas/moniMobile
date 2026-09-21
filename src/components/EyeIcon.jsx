import { Text } from "react-native";

/**
 * Toggleable password visibility icon.
 * visible=true → show "hide" icon (🙈), visible=false → show "view" icon (👁️)
 */
export function EyeIcon({ visible }) {
  return (
    <Text style={{ fontSize: 18 }}>{visible ? "🙈" : "👁️"}</Text>
  );
}
