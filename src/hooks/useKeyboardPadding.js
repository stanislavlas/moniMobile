import { useState, useEffect } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Returns the current keyboard height so a ScrollView can add it as
 * paddingBottom, keeping content (including submit buttons) above the keyboard.
 *
 * Works correctly even when the component is nested inside a horizontal
 * paging ScrollView (where KeyboardAvoidingView cannot measure properly).
 */
export function useKeyboardPadding() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return keyboardHeight;
}
