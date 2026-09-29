/**
 * ServerUrlEditor
 * ---------------
 * Shared expand/collapse server URL input with validation.
 * Used in AuthScreen and AccountScreen.
 *
 * Props:
 *   visible      {boolean}  - Whether the editor is expanded
 *   draft        {string}   - Current draft URL value
 *   onChangeDraft {fn}      - Called with the new draft string
 *   onSave       {fn}       - Called when user presses Save (async ok)
 *   currentUrl   {string}   - The currently saved URL (shown as subtitle)
 *   placeholder  {string}   - Input placeholder (DEFAULT_URL)
 */
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { useTheme } from "../contexts/ThemeContext.js";

export function ServerUrlEditor({ visible, draft, onChangeDraft, onSave, currentUrl, placeholder }) {
  const { colors: C, styles: S } = useTheme();

  return (
    <View>
      {currentUrl ? (
        <Text style={[S.small, { marginTop: 4 }]} numberOfLines={1}>{currentUrl}</Text>
      ) : null}
      {visible && (
        <View style={{ marginTop: 14 }}>
          <Text style={[S.label, { marginBottom: 5 }]}>Backend URL</Text>
          <TextInput
            style={S.input}
            value={draft}
            onChangeText={onChangeDraft}
            placeholder={placeholder}
            placeholderTextColor={C.textTertiary}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TouchableOpacity style={[S.btnPrimary, { backgroundColor: C.green }]} onPress={onSave}>
            <Text style={S.btnPrimaryText}>Save</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
