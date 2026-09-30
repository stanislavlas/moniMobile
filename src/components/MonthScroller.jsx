/**
 * MonthScroller
 * -------------
 * Horizontally-scrollable list of month pills used by both MonthOverviewScreen
 * and HistoryScreen.
 *
 * Props:
 *   monthsData  — [{ key: "YYYY-MM", month: number, year: number }]
 *   filterMonth — currently selected "YYYY-MM"
 *   onSelect    — called with the selected "YYYY-MM" key
 *   compact     — smaller pill style for inline use (default false)
 *   style       — extra style for the outer ScrollView
 */
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { MONTH_SHORT } from "../utils/theme.js";
import { useTheme } from "../contexts/ThemeContext.js";

export function MonthScroller({ monthsData, filterMonth, onSelect, compact = false, style }) {
  const { colors: C } = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: compact ? 0 : 10, gap: compact ? 6 : 0, paddingVertical: 2 }}
      style={style}
    >
      {monthsData.map(({ key, month, year }) => {
        const isActive = key === filterMonth;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onSelect(key)}
            style={{
              paddingHorizontal: compact ? 14 : 18,
              paddingVertical:   compact ? 8  : 12,
              borderRadius: 10,
              backgroundColor: isActive ? C.green : C.cardBg,
              marginHorizontal: compact ? 0 : 4,
              borderWidth: 0.5,
              borderColor: isActive ? C.green : C.border,
            }}
          >
            <Text style={{
              fontSize: compact ? 13 : 16,
              fontWeight: "700",
              color: isActive ? "#fff" : C.text,
              marginBottom: compact ? 0 : 2,
            }}>
              {MONTH_SHORT[month]} {compact ? year : ""}
            </Text>
            {!compact && (
              <Text style={{ fontSize: 11, color: isActive ? "#fff" : C.textTertiary, fontWeight: isActive ? "700" : "400" }}>
                {year}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
