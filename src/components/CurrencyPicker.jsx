// mobile/src/components/CurrencyPicker.jsx
import { useState } from "react";
import { Modal, View, Text, TextInput, FlatList, TouchableOpacity } from "react-native";
import { useTheme } from "../contexts/ThemeContext.js";

export function CurrencyPicker({ visible, selected, currencyList, onSelect, onClose }) {
  const { colors: C, styles: S } = useTheme();
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? currencyList.filter(({ code, name }) =>
        code.toLowerCase().includes(search.toLowerCase()) ||
        name.toLowerCase().includes(search.toLowerCase())
      )
    : currencyList;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View style={{
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          paddingHorizontal: 20, paddingVertical: 14,
          borderBottomWidth: 0.5, borderBottomColor: C.border,
        }}>
          <Text style={S.h3}>Select Currency</Text>
          <TouchableOpacity onPress={() => { setSearch(""); onClose(); }}>
            <Text style={{ fontSize: 16, color: C.textSecondary }}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <TextInput
            style={[S.input, { marginBottom: 0 }]}
            placeholder="Search currency..."
            placeholderTextColor={C.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={({ code }) => code}
          renderItem={({ item: { code, name } }) => {
            const active = code === selected;
            return (
              <TouchableOpacity
                style={{
                  paddingHorizontal: 20, paddingVertical: 14,
                  borderBottomWidth: 0.5, borderBottomColor: C.border,
                  backgroundColor: active ? C.greenLight : C.bg,
                  flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                }}
                onPress={() => { onSelect(code); setSearch(""); onClose(); }}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: active ? C.greenDark : C.text, width: 48 }}>
                  {code}
                </Text>
                <Text style={{ fontSize: 13, color: active ? C.greenDark : C.textSecondary, flex: 1, marginLeft: 8 }}>
                  {name}
                </Text>
                {active && <Text style={{ color: C.green, fontSize: 16 }}>✓</Text>}
              </TouchableOpacity>
            );
          }}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    </Modal>
  );
}
