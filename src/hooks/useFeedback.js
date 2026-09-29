import { useState, useCallback } from "react";
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

  const flash = useCallback((ok, msg) => {
    setFeedback({ ok, msg });
    if (ok) {
      setTimeout(() => setFeedback(null), duration);
    }
  }, [duration]);

  return { feedback, flash };
}
