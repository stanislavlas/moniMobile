import { useState } from "react";
import { View, TextInput, TouchableOpacity } from "react-native";
import { useTheme } from "../contexts/ThemeContext.js";
import { EyeIcon } from "./EyeIcon.jsx";

/**
 * A password TextInput wrapped with an eye-icon toggle for visibility.
 *
 * Props:
 *   value, onChangeText  — standard TextInput props
 *   placeholder          — placeholder text (default "••••••••")
 *   style                — extra style merged onto the outer wrapper View
 *   inputStyle           — extra style merged onto the inner TextInput
 */
export function PasswordInput({ value, onChangeText, placeholder = "••••••••", style, inputStyle }) {
  const { colors: C, styles: S } = useTheme();
  const [show, setShow] = useState(false);

  return (
    <View style={[S.input, { flexDirection: "row", alignItems: "center", paddingVertical: 0, marginBottom: 12 }, style]}>
      <TextInput
        style={[{ flex: 1, fontSize: 15, color: C.text, paddingVertical: 12 }, inputStyle]}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!show}
        placeholder={placeholder}
        placeholderTextColor={C.textTertiary}
      />
      <TouchableOpacity onPress={() => setShow(v => !v)} style={{ paddingHorizontal: 8 }}>
        <EyeIcon visible={show} />
      </TouchableOpacity>
    </View>
  );
}
