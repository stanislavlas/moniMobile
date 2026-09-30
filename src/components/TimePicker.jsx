import { useState, useEffect, useRef } from "react";
import { Modal, View, Text, TouchableOpacity, Pressable, FlatList } from "react-native";
import { useTheme } from "../contexts/ThemeContext.js";

const ITEM_HEIGHT = 48;
const VISIBLE     = 5;
const PICKER_H    = ITEM_HEIGHT * VISIBLE;
const PAD         = ITEM_HEIGHT * Math.floor(VISIBLE / 2);

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function Column({ data, selectedIndex, onSelect, label, resetKey }) {
  const { colors: C } = useTheme();
  const listRef     = useRef(null);
  const hasMomentum = useRef(false);
  const isJumping   = useRef(false); // true while we silently reposition

  function scrollTo(index, animated = false) {
    // offset = index * ITEM_HEIGHT — the FlatList's scroll position maps directly to
    // item offsets regardless of paddingVertical (padding shifts content, not viewport).
    listRef.current?.scrollToOffset({ offset: index * ITEM_HEIGHT, animated });
  }

  useEffect(() => {
    const t = setTimeout(() => scrollTo(selectedIndex, false), 100);
    return () => clearTimeout(t);
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // selectedIndex is intentionally omitted: the reset timer is only needed on
  // open/reset (driven by resetKey). User-tap selections go through scrollTo()
  // directly in the TouchableOpacity handler.

  function snap(offsetY) {
    // offsetY is the viewport scroll position. Item i is centered when offsetY = i * ITEM_HEIGHT.
    // Clamp to valid range to prevent selecting out-of-bounds indices.
    const index   = Math.round(offsetY / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(index, data.length - 1));
    onSelect(clamped);
    isJumping.current = true;
    listRef.current?.scrollToOffset({ offset: clamped * ITEM_HEIGHT, animated: false });
    setTimeout(() => { isJumping.current = false; }, 50);
  }

  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color: C.textTertiary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{ width: 76, height: PICKER_H }}>
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(_, i) => String(i)}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          initialNumToRender={VISIBLE + 2}
          getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
          contentContainerStyle={{ paddingVertical: PAD }}
          nestedScrollEnabled
          onScrollBeginDrag={() => { hasMomentum.current = false; }}
          onMomentumScrollBegin={() => { hasMomentum.current = true; }}
          onMomentumScrollEnd={(e) => {
            if (isJumping.current) return;
            hasMomentum.current = false;
            // subtract PAD so index 0 maps to offsetY 0
            snap(e.nativeEvent.contentOffset.y);
          }}
          onScrollEndDrag={(e) => {
            if (isJumping.current) return;
            if (!hasMomentum.current) snap(e.nativeEvent.contentOffset.y);
          }}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => {
            const isSelected = index === selectedIndex;
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  onSelect(index);
                  scrollTo(index, true);
                }}
                style={{ height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center" }}
              >
                <Text style={{
                  fontSize:   isSelected ? 22 : 17,
                  fontWeight: isSelected ? "700" : "400",
                  color:      isSelected ? C.greenDark : C.textSecondary,
                }}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />

        <View pointerEvents="none" style={{
          position: "absolute", top: PAD, left: 4, right: 4,
          height: ITEM_HEIGHT, borderRadius: 10,
          backgroundColor: C.greenLight, opacity: 0.5,
          borderWidth: 1.5, borderColor: C.greenBorder,
        }} />
      </View>
    </View>
  );
}

function parseTime(str) {
  const [h = "20", m = "00"] = (str || "20:00").split(":");
  const hour = Math.max(0, Math.min(parseInt(h, 10) || 0, 23));
  const min  = Math.round(Math.max(0, Math.min(parseInt(m, 10) || 0, 59)) / 5) % 12;
  return { hour, min };
}

export function TimePicker({ visible, value = "20:00", onChange, onClose }) {
  const { colors: C, styles: S } = useTheme();

  const [hourIdx,  setHourIdx]  = useState(() => parseTime(value).hour);
  const [minIdx,   setMinIdx]   = useState(() => parseTime(value).min);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (visible) {
      const { hour, min } = parseTime(value);
      setHourIdx(hour);
      setMinIdx(min);
      setResetKey(k => k + 1);
    }
  }, [visible, value]);

  const hh = String(hourIdx).padStart(2, "0");
  const mm = String(minIdx * 5).padStart(2, "0");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" }}
        onPress={onClose}
      >
        <Pressable style={{
          backgroundColor: C.cardBg, borderRadius: 20,
          paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20, width: 300,
          shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18, shadowRadius: 16, elevation: 12,
        }}>
          <Text style={[S.h3, { textAlign: "center", marginBottom: 20 }]}>Reminder Time</Text>

          <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "flex-start", gap: 8, marginBottom: 20 }}>
            <Column data={HOURS}   selectedIndex={hourIdx} onSelect={setHourIdx} label="Hour"   resetKey={resetKey} />
            <Text style={{ fontSize: 28, fontWeight: "700", color: C.text, marginTop: PICKER_H / 2 - 4 }}>:</Text>
            <Column data={MINUTES} selectedIndex={minIdx}  onSelect={setMinIdx}  label="Minute" resetKey={resetKey} />
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: C.bgSecondary, alignItems: "center" }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: C.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onChange?.(`${hh}:${mm}`)}
              style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: C.green, alignItems: "center" }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Done</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
