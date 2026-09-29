import { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext.js";

/**
 * Fixed-position success / error feedback banner.
 * Slides in from the top of the screen, floats above all content.
 *
 * Props:
 *   feedback  — { ok: boolean, msg: string } | null
 *               When null the component animates out and unmounts.
 *   style     — ignored (kept for API compatibility)
 */
export function FeedbackBanner({ feedback }) {
  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();

  // Track what to actually render (we need to keep rendering during slide-out)
  const [displayed, setDisplayed] = useState(feedback);
  const translateY = useRef(new Animated.Value(-120)).current;
  const isVisible  = useRef(false);

  useEffect(() => {
    if (feedback) {
      // New message — update displayed content immediately, then slide in
      setDisplayed(feedback);
      isVisible.current = true;
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
        speed: 14,
      }).start();
    } else {
      if (!isVisible.current) return;
      // Slide out, then clear rendered content
      isVisible.current = false;
      Animated.timing(translateY, {
        toValue: -120,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setDisplayed(null));
    }
  }, [feedback]);

  if (!displayed) return null;

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 12,
        right: 12,
        zIndex: 9999,
        transform: [{ translateY }],
        // iOS shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        // Android shadow
        elevation: 8,
      }}
    >
      <View
        style={{
          padding: 14,
          borderRadius: 12,
          borderWidth: 0.5,
          backgroundColor: displayed.ok ? C.greenLight : C.redLight,
          borderColor:     displayed.ok ? C.greenBorder : C.redBorder,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "500", color: displayed.ok ? C.greenDark : C.redDark }}>
          {displayed.msg}
        </Text>
      </View>
    </Animated.View>
  );
}
