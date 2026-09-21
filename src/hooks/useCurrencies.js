// mobile/src/hooks/useCurrencies.js
import { useState, useEffect } from "react";
import { fetchCurrencies } from "../services/currencies.js";

export function useCurrencies() {
  const [currencies, setCurrencies] = useState({});
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    fetchCurrencies()
      .then(setCurrencies)
      .catch(() => {
        // Minimal fallback if backend unreachable on first launch
        setCurrencies({ EUR: "Euro", USD: "United States Dollar", CZK: "Czech Koruna" });
      })
      .finally(() => setLoading(false));
  }, []);

  // Sorted array for rendering
  const currencyList = Object.entries(currencies)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return { currencies, currencyList, loading };
}
