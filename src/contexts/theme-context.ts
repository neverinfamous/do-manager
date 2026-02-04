/**
 * Theme context for do-manager
 *
 * This file only exports the context type and context object.
 * The ThemeProvider component is in a separate file to satisfy react-refresh.
 */

import { createContext } from "react";

export type Theme = "light" | "dark" | "system";

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

export const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined,
);
