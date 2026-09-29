import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";

type Theme = "light" | "dark";
const storageKey = "pdfburrow-theme";
const storageMessage = "Your theme could not be saved. It will apply only to this visit.";

const readTheme = (): { theme: Theme; error: string } => {
  try {
    const value = localStorage.getItem(storageKey);
    if (value === null || value === "light" || value === "dark") {
      return { theme: value ?? "dark", error: "" };
    }
    console.warn("PDFBurrow found an invalid saved theme preference.");
    return { theme: "dark", error: "The saved theme was not recognized. Using dark mode." };
  } catch (error) {
    console.warn("PDFBurrow could not read the theme preference.", error);
    return { theme: "dark", error: storageMessage };
  }
};

interface ThemeContextValue {
  readonly theme: Theme;
  readonly error: string;
  readonly setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [preference, setPreference] = useState(readTheme);
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", preference.theme === "dark");
    document.documentElement.style.colorScheme = preference.theme;
  }, [preference.theme]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) {
        setPreference(readTheme());
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const setTheme = (theme: Theme) => {
    let error = "";
    try {
      localStorage.setItem(storageKey, theme);
    } catch (cause) {
      console.warn("PDFBurrow could not save the theme preference.", cause);
      error = storageMessage;
    }
    setPreference({ theme, error });
  };
  return (
    <ThemeContext.Provider value={{ ...preference, setTheme }}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider.");
  }
  return context;
};
