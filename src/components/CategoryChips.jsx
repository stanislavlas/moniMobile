import { ScrollView, View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../contexts/ThemeContext.js";

/**
 * A 2-row horizontally scrollable grid of tappable category chip buttons.
 * Categories are distributed top-row / bottom-row by index (0,2,4… / 1,3,5…).
 *
 * Props:
 *   categories    — array of category objects { id | categoryId, emoji, label }
 *   selected      — currently selected category id
 *   onSelect      — called with categoryId when a chip is tapped
 *   colorMap      — { [categoryId]: colorString }
 *   style         — optional extra style for the outer ScrollView
 */
export function CategoryChips({ categories, selected, onSelect, colorMap, style }) {
  const { colors: C } = useTheme();

  const topRow    = categories.filter((_, i) => i % 2 === 0);
  const bottomRow = categories.filter((_, i) => i % 2 !== 0);

  function renderChip(cat) {
    const catId  = cat.id || cat.categoryId;
    const active = selected === catId;
    const color  = colorMap[catId] || C.textSecondary;

    return (
      <TouchableOpacity
        key={catId}
        onPress={() => onSelect(catId)}
        style={{
          paddingHorizontal: 13,
          paddingVertical: 7,
          borderRadius: 20,
          borderWidth: 0.5,
          borderColor: active ? color : C.border,
          backgroundColor: active ? color + "20" : C.bgSecondary,
        }}
      >
        <Text style={{ fontSize: 13, color: active ? color : C.textSecondary, fontWeight: active ? "600" : "400" }}>
          {cat.emoji} {cat.label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ flexDirection: "column", gap: 8, paddingVertical: 2 }}
      style={style}
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
        {topRow.map(renderChip)}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {bottomRow.map(renderChip)}
      </View>
    </ScrollView>
  );
}
