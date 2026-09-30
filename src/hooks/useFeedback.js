import { useState, useCallback, useRef, useEffect } from "react";
import { FLASH_DURATION_MS } from "../utils/constants.js";

/**
 * Shared feedback flash helper.
 * `flash(ok, msg)` sets feedback state and auto-clears after `duration` ms when ok=true.
 *
 * @param {number} duration - Auto-dismiss duration in ms (default: FLASH_DURATION_MS)
 * @returns {{ feedback, flash }}
 */
export function useFeedback(duration = FLASH_DURATION_MS) {
  const [feedback, setFeedback] = useState(null);
  const timerRef = useRef(null);

  // Clean up pending timer on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const flash = useCallback((ok, msg) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFeedback({ ok, msg });
    if (ok) {
      timerRef.current = setTimeout(() => { timerRef.current = null; setFeedback(null); }, duration);
    }
  }, [duration]);

  return { feedback, flash };
}
