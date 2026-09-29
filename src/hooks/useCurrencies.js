// mobile/src/hooks/useCurrencies.js
import { useState, useCallback } from "react";
import { fetchCurrencies } from "../services/currencies.js";

export function useCurrencies() {
  const [currencies, setCurrencies] = useState({});
  const [loading, setLoading]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCurrencies();
      setCurrencies(data);
    } catch {
      setCurrencies({ EUR: "Euro", USD: "United States Dollar", CZK: "Czech Koruna" });
    } finally {
      setLoading(false);
    }
  }, []);

  const currencyList = Object.entries(currencies)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return { currencies, currencyList, loading, load };
}
