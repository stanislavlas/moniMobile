import { StyleSheet } from "react-native";
import { createContext, useContext } from "react";

// Light theme colors
export const lightColors = {
  // Brand
  green:        "#1D9E75",
  greenLight:   "#E1F5EE",
  greenDark:    "#0F6E56",
  greenBorder:  "#5DCAA5",
  red:          "#D85A30",
  redLight:     "#FAECE7",
  redDark:      "#993C1D",
  redBorder:    "#F0997B",
  amber:        "#EF9F27",
  amberLight:   "#FAEEDA",
  amberBorder:  "#FAC775",
  amberDark:    "#854F0B",
  amberText:    "#BA7517",
  blue:         "#378ADD",
  blueLight:    "#DBEEFF",
  blueDark:     "#1565C0",
  // Neutral
  bg:           "#FFFFFF",
  bgSecondary:  "#F5F5F3",
  bgTertiary:   "#EBEBEA",
  cardBg:       "#FFFFFF",
  text:         "#1A1A18",
  textSecondary:"#6B6B68",
  textTertiary: "#A3A3A0",
  border:       "rgba(0,0,0,0.1)",
  borderMed:    "rgba(0,0,0,0.15)",
};

// Dark theme colors
export const darkColors = {
  // Brand (slightly adjusted for dark mode)
  green:        "#2ECC8F",
  greenLight:   "#1A3D32",
  greenDark:    "#5DCAA5",
  greenBorder:  "#2ECC8F",
  red:          "#FF7961",
  redLight:     "#3D2620",
  redDark:      "#FF9E8A",
  redBorder:    "#FF7961",
  amber:        "#FFB347",
  amberLight:   "#3D2E1A",
  amberBorder:  "#B87828",
  amberDark:    "#FFD080",
  amberText:    "#FFD080",
  blue:         "#64B5F6",
  blueLight:    "#1A2E40",
  blueDark:     "#90CAF9",
  // Neutral
  bg:           "#121212",
  bgSecondary:  "#1E1E1E",
  bgTertiary:   "#2A2A2A",
  cardBg:       "#1E1E1E",
  text:         "#E8E8E8",
  textSecondary:"#A0A0A0",
  textTertiary: "#707070",
  border:       "rgba(255,255,255,0.1)",
  borderMed:    "rgba(255,255,255,0.15)",
};

// Default to light theme
export let C = lightColors;

// Theme context
export const ThemeContext = createContext({
  isDark: false,
  toggleTheme: () => {},
  colors: lightColors,
});

export const useTheme = () => useContext(ThemeContext);

// Function to get theme colors
export const getColors = (isDark) => isDark ? darkColors : lightColors;

export const FONTS = {
  regular:  "System",
  mono:     "Courier",
};

// Dynamic styles function
export const getStyles = (colors) => StyleSheet.create({
  // Layout
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  pad:    { paddingHorizontal: 20 },

  // Typography
  h1:     { fontSize: 28, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
  h2:     { fontSize: 20, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  h3:     { fontSize: 16, fontWeight: "600", color: colors.text },
  body:   { fontSize: 15, fontWeight: "400", color: colors.text, lineHeight: 22 },
  small:  { fontSize: 13, fontWeight: "400", color: colors.textSecondary },
  label:  { fontSize: 11, fontWeight: "600", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 },
  mono:   { fontFamily: FONTS.mono },

  // Card
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },

  // Input
  input: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: colors.borderMed,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
  },

  // Buttons
  btnPrimary: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  btnPrimaryText: { fontSize: 16, fontWeight: "700", color: "#fff" },

  // Row
  row:         { flexDirection: "row", alignItems: "center" },
  rowBetween:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  // Divider
  divider: { height: 0.5, backgroundColor: colors.border },

  // Section title
  sectionTitle: { fontSize: 11, fontWeight: "600", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
});

// Default light theme styles
export const S = getStyles(lightColors);

export function fmt(n) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

export const MONTH_LABELS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const MONTH_SHORT  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
