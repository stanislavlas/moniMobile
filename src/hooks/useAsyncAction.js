import { useState, useCallback } from "react";

/**
 * Provides a `run(fn)` helper with loading / error state for React Native screens.
 *
 * @returns {{ loading, error, run }}
 */
export function useAsyncAction() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const run = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err.message ?? "Something went wrong");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, run };
}
