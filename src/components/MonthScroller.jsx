/**
 * MonthScroller
 * -------------
 * Horizontally-scrollable list of month pills used by both MonthOverviewScreen
 * and HistoryScreen.
 *
 * Props:
 *   monthsData     — [{ key: "YYYY-MM", month: number, year: number }]
 *   filterMonth    — currently selected "YYYY-MM"
 *   onSelect       — called with the selected "YYYY-MM" key
 *   compact        — smaller pill style for inline use (default false)
 *   style          — extra style for the outer ScrollView
 *   hasMore        — when true, renders a "Show more" pill at the end
 *   onLoadMore     — called when the user taps the "Show more" pill
 *   onCountChange  — called with the number of pills that fit in the visible width
 */
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { MONTH_SHORT } from "../utils/theme.js";
import { useTheme } from "../contexts/ThemeContext.js";

// Pill dimensions (must match the style objects below)
const PILL_WIDTH_COMPACT     = 14 * 2 + 1 + 62; // paddingH×2 + border + ~text width
const PILL_WIDTH_NORMAL      = 18 * 2 + 1 + 8 * 2 + 40; // paddingH×2 + border + marginH×2 + ~text
const GAP_COMPACT            = 6;
const GAP_NORMAL             = 0; // spacing comes from marginHorizontal on each pill

export function MonthScroller({ monthsData, filterMonth, onSelect, compact = false, style, hasMore = false, onLoadMore, onCountChange }) {
  const { colors: C } = useTheme();

  const pillWidth = compact ? PILL_WIDTH_COMPACT : PILL_WIDTH_NORMAL;
  const gap       = compact ? GAP_COMPACT        : GAP_NORMAL;

  const handleLayout = ({ nativeEvent: { layout: { width } } }) => {
    if (!onCountChange) return;
    // Subtract half a pill width so the last visible pill is cut off,
    // hinting the user that there are more months to scroll to.
    const count = Math.max(1, Math.floor((width - pillWidth * 0.5 + gap) / (pillWidth + gap)));
    onCountChange(count);
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      onLayout={handleLayout}
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

      {hasMore && (
        <TouchableOpacity
          onPress={onLoadMore}
          style={{
            paddingHorizontal: compact ? 14 : 18,
            paddingVertical:   compact ? 8  : 12,
            borderRadius: 10,
            backgroundColor: "transparent",
            marginHorizontal: compact ? 0 : 4,
            borderWidth: 0.5,
            borderColor: C.border,
            borderStyle: "dashed",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: compact ? 12 : 13, color: C.textTertiary, fontWeight: "500" }}>
            Show more
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

