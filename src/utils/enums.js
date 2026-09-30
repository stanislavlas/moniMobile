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
  NECESSARY: "NECESSARY",
  OPTIONAL:  "OPTIONAL",
};

/**
 * Converts a UI necessity value ("necessary" | "optional") to the API format.
 * The API now uses "NECESSARY" / "OPTIONAL" directly.
 */
export function toApiNecessity(uiNecessity) {
  return uiNecessity === "optional" ? Necessity.OPTIONAL : Necessity.NECESSARY;
}

/**
 * Converts an API necessity string to the UI format ("necessary" | "optional").
 * Accepts both the current values (NECESSARY/OPTIONAL) and legacy values (NEED/WANT)
 * that may still be present in locally-cached entries.
 */
export function fromApiNecessity(apiNecessity) {
  if (apiNecessity === "OPTIONAL" || apiNecessity === "WANT" || apiNecessity === "optional") return "optional";
  return "necessary"; // covers NECESSARY, NEED, lowercase "necessary", and any unknown value
}

/** Returns true when an entry's necessity is "necessary" (handles both API and UI values). */
export const isNecessary = (entry) => fromApiNecessity(entry.necessity) === "necessary";

/** Returns true when an entry's necessity is "optional" (handles both API and UI values). */
export const isOptional  = (entry) => fromApiNecessity(entry.necessity) === "optional";

/**
 * Format a numeric value as a locale-sensitive currency string.
 * Uses Intl.NumberFormat for correct locale formatting across all currencies.
 * Falls back to a simple "{value} {currency}" representation if Intl is unavailable
 * or the currency code is not recognised.
 */
export function formatCurrency(value, currency) {
  const num = typeof value === "number" ? value : parseFloat(value) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    // Fallback for unrecognised currency codes
    return `${num.toFixed(2)} ${currency || ""}`.trim();
  }
}
