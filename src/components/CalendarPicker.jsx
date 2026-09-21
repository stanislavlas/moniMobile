import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../contexts/ThemeContext.js";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * A fully custom inline calendar date-picker.
 *
 * Props:
 *   value      — currently selected date string "YYYY-MM-DD"
 *   onChange   — called with new date string "YYYY-MM-DD" when a day is tapped
 *   accentColor — highlight color for selected day (defaults to green)
 */
export function CalendarPicker({ value, onChange, accentColor }) {
  const { colors: C } = useTheme();
  const accent = accentColor || C.green;

  const [pickerMonth, setPickerMonth] = useState(
    () => new Date((value || new Date().toISOString().slice(0, 10)) + "T00:00:00")
  );

  const today = new Date().toISOString().slice(0, 10);

  function prevMonth() {
    const d = new Date(pickerMonth);
    d.setMonth(d.getMonth() - 1);
    setPickerMonth(d);
  }

  function nextMonth() {
    const d = new Date(pickerMonth);
    d.setMonth(d.getMonth() + 1);
    setPickerMonth(d);
  }

  function buildWeeks() {
    const year = pickerMonth.getFullYear();
    const month = pickerMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const weeks = [];
    let week = [];

    for (let i = 0; i < firstDay; i++) {
      week.push(<View key={`empty-start-${i}`} style={{ flex: 1, aspectRatio: 1 }} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isSelected = dateStr === value;
      const isToday = dateStr === today;

      week.push(
        <TouchableOpacity
          key={day}
          onPress={() => onChange(dateStr)}
          style={{
            flex: 1,
            aspectRatio: 1,
            justifyContent: "center",
            alignItems: "center",
            borderRadius: 8,
            backgroundColor: isSelected ? accent : "transparent",
            borderWidth: isToday && !isSelected ? 1 : 0,
            borderColor: accent,
          }}
        >
          <Text style={{
            fontSize: 14,
            color: isSelected ? "#fff" : C.text,
            fontWeight: isSelected || isToday ? "600" : "400",
          }}>
            {day}
          </Text>
        </TouchableOpacity>
      );

      if (week.length === 7) {
        weeks.push(
          <View key={`week-${weeks.length}`} style={{ flexDirection: "row", marginBottom: 4 }}>
            {week}
          </View>
        );
        week = [];
      }
    }

    while (week.length > 0 && week.length < 7) {
      week.push(<View key={`empty-end-${week.length}`} style={{ flex: 1, aspectRatio: 1 }} />);
    }
    if (week.length > 0) {
      weeks.push(
        <View key={`week-${weeks.length}`} style={{ flexDirection: "row", marginBottom: 4 }}>
          {week}
        </View>
      );
    }

    return weeks;
  }

  return (
    <View style={{ backgroundColor: C.cardBg, borderRadius: 10, padding: 16, borderWidth: 0.5, borderColor: C.border }}>
      {/* Month/Year header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <TouchableOpacity onPress={prevMonth} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18, color: C.text }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>
          {pickerMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18, color: C.text }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Weekday labels */}
      <View style={{ flexDirection: "row", marginBottom: 8 }}>
        {WEEKDAYS.map((day, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: C.textTertiary }}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      {buildWeeks()}
    </View>
  );
}
