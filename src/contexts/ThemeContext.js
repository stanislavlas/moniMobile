import React, { createContext, useState, useContext, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lightColors, darkColors, getStyles } from "../utils/theme.js";

const ThemeContext = createContext();

const THEME_KEY = "budget_theme";

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load theme preference on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        if (saved !== null) {
          setIsDark(saved === "dark");
        }
      } catch (e) {
        console.error("Failed to load theme:", e);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const toggleTheme = async () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    try {
      await AsyncStorage.setItem(THEME_KEY, newTheme ? "dark" : "light");
    } catch (e) {
      console.error("Failed to save theme:", e);
    }
  };

  const colors = isDark ? darkColors : lightColors;
  const styles = getStyles(colors);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors, styles, isLoaded }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
