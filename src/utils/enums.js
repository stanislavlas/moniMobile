/**
 * Enum mappings between mobile app (UI-friendly) and backend (API format)
 * Backend uses uppercase enum values, mobile uses lowercase for internal state
 */

// Transaction Type mapping
export const TransactionType = {
  EXPENSE: "EXPENSE",
  INCOME: "INCOME",
  INVESTMENT: "INVESTMENT",
};

export function toApiTransactionType(uiType) {
  const map = {
    expense: TransactionType.EXPENSE,
    income: TransactionType.INCOME,
    investment: TransactionType.INVESTMENT,
  };
  return map[uiType] || TransactionType.EXPENSE;
}

export function fromApiTransactionType(apiType) {
  const map = {
    EXPENSE: "expense",
    INCOME: "income",
    INVESTMENT: "investment",
  };
  return map[apiType] || "expense";
}

// Necessity mapping
export const Necessity = {
  NEED: "NEED",
  WANT: "WANT",
};

export function toApiNecessity(uiNecessity) {
  const map = {
    necessary: Necessity.NEED,
    optional: Necessity.WANT,
  };
  return map[uiNecessity] || Necessity.NEED;
}

export function fromApiNecessity(apiNecessity) {
  const map = {
    NEED: "necessary",
    WANT: "optional",
  };
  return map[apiNecessity] || "necessary";
}

// Currency (already uppercase, no mapping needed)
export const Currency = {
  EUR: "EUR",
  USD: "USD",
  CZK: "CZK",
};

// Member Role
export const MemberRole = {
  OWNER: "OWNER",
  MEMBER: "MEMBER",
};

const CURRENCY_SYMBOLS = {
  AUD: "A$",  BRL: "R$",  CAD: "C$",  CHF: "CHF", CNY: "¥",   CZK: "Kč",
  DKK: "kr",  EUR: "€",   GBP: "£",   HKD: "HK$", HUF: "Ft",  IDR: "Rp",
  ILS: "₪",   INR: "₹",   ISK: "kr",  JPY: "¥",   KRW: "₩",   MXN: "MX$",
  MYR: "RM",  NOK: "kr",  NZD: "NZ$", PHP: "₱",   PLN: "zł",  RON: "lei",
  SEK: "kr",  SGD: "S$",  THB: "฿",   TRY: "₺",   USD: "$",   ZAR: "R",
};

// Currencies where symbol follows the number
const SUFFIX_CURRENCIES = new Set(["CZK", "HUF", "PLN", "RON", "SEK", "NOK", "DKK", "ISK"]);

export function formatCurrency(value, currency) {
  const symbol    = CURRENCY_SYMBOLS[currency] || currency || "";
  const num       = typeof value === "number" ? value : parseFloat(value) || 0;
  const formatted = num.toFixed(2);
  return SUFFIX_CURRENCIES.has(currency)
    ? `${formatted} ${symbol}`
    : `${symbol}${formatted}`;
}
