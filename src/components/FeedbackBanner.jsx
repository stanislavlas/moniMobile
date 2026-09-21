import { View, Text } from "react-native";
import { useTheme } from "../contexts/ThemeContext.js";

/**
 * Inline success / error feedback banner.
 *
 * Props:
 *   feedback  — { ok: boolean, msg: string } | null
 *               When null the component renders nothing.
 *   style     — optional extra style for the outer View
 */
export function FeedbackBanner({ feedback, style }) {
  const { colors: C } = useTheme();

  if (!feedback) return null;

  return (
    <View style={[{
      padding: 12,
      borderRadius: 10,
      borderWidth: 0.5,
      marginBottom: 14,
      backgroundColor: feedback.ok ? C.greenLight : C.redLight,
      borderColor: feedback.ok ? C.greenBorder : C.redBorder,
    }, style]}>
      <Text style={{ fontSize: 13, color: feedback.ok ? C.greenDark : C.redDark }}>
        {feedback.msg}
      </Text>
    </View>
  );
}
