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
 *   onCountChange  — called with the number of month pills that fit fully visible
 *                    (excluding the "Show more" pill, which is always fully visible)
 */
import { useRef } from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { MONTH_SHORT } from "../utils/theme.js";
import { useTheme } from "../contexts/ThemeContext.js";

export function MonthScroller({ monthsData, filterMonth, onSelect, compact = false, style, hasMore = false, onLoadMore, onCountChange }) {
  const { colors: C } = useTheme();

  const containerWidth  = useRef(0);
  const pillWidth       = useRef(0);
  const showMoreWidth   = useRef(0);

  const gap = compact ? 6 : 8; // compact uses gap:6, normal uses marginHorizontal:4 per side

  const recalculate = () => {
    if (!onCountChange || containerWidth.current === 0 || pillWidth.current === 0) return;
    // If "Show more" is not visible yet, don't wait for its measurement —
    // use the full container width so we get an early count to the hook.
    // Once "Show more" appears and is measured, recalculate will fire again
    // with the correct reserved space.
    const reserved = showMoreWidth.current > 0 ? showMoreWidth.current + gap : 0;
    // Reserve space for "Show more" + its gap so it is always fully visible.
    // Fill the remaining width with as many month pills as fit, leaving half a
    // pill peeking on the right to hint the user that more months can be scrolled to.
    const usable = containerWidth.current - reserved;
    const count  = Math.max(1, Math.floor((usable - pillWidth.current * 0.5 + gap) / (pillWidth.current + gap)));
    onCountChange(count);
  };

  const handleContainerLayout = ({ nativeEvent: { layout: { width } } }) => {
    containerWidth.current = width;
    recalculate();
  };

  const handlePillLayout = ({ nativeEvent: { layout: { width } } }) => {
    if (pillWidth.current !== 0) return; // measure once
    pillWidth.current = width;
    recalculate();
  };

  const handleShowMoreLayout = ({ nativeEvent: { layout: { width } } }) => {
    if (showMoreWidth.current !== 0) return; // measure once
    showMoreWidth.current = width;
    recalculate();
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
          onLayout={handleShowMoreLayout}
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
