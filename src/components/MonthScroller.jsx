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
import { useRef } from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { MONTH_SHORT } from "../utils/theme.js";
import { useTheme } from "../contexts/ThemeContext.js";

export function MonthScroller({ monthsData, filterMonth, onSelect, compact = false, style, hasMore = false, onLoadMore, onCountChange }) {
  const { colors: C } = useTheme();

  const containerWidth = useRef(0);
  const pillWidth      = useRef(0);

  const gap = compact ? 6 : 8; // gap-2 equiv for non-compact (marginHorizontal: 4 each side)

  const handleContainerLayout = ({ nativeEvent: { layout: { width } } }) => {
    containerWidth.current = width;
    recalculate();
  };

  const handlePillLayout = ({ nativeEvent: { layout: { width } } }) => {
    if (pillWidth.current !== 0) return; // only measure once
    pillWidth.current = width;
    recalculate();
  };

  const recalculate = () => {
    if (!onCountChange || containerWidth.current === 0 || pillWidth.current === 0) return;
    // Leave half a pill peeking on the right to hint scrollability
    const count = Math.max(1, Math.floor((containerWidth.current - pillWidth.current * 0.5 + gap) / (pillWidth.current + gap)));
    onCountChange(count);
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      onLayout={handleContainerLayout}
      contentContainerStyle={{ paddingHorizontal: compact ? 0 : 10, gap: compact ? 6 : 0, paddingVertical: 2 }}
      style={style}
    >
      {monthsData.map(({ key, month, year }, index) => {
        const isActive = key === filterMonth;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onSelect(key)}
            onLayout={index === 0 ? handlePillLayout : undefined}
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

