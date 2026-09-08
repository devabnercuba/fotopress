import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSettings } from "./settings";

export type ThemeMode = "light" | "dark";

export const ACCENTS = [
  { id: "indigo", label: "Índigo", hue: 232, chroma: 0.13 },
  { id: "emerald", label: "Verde", hue: 158, chroma: 0.12 },
  { id: "amber", label: "Âmbar", hue: 65, chroma: 0.14 },
  { id: "rose", label: "Rosa", hue: 15, chroma: 0.14 },
  { id: "slate", label: "Grafite", hue: 265, chroma: 0.02 },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

type ThemeContextValue = {
  mode: ThemeMode;
  accent: AccentId;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Garante que o banco de dados seja a fonte principal das preferências de cor.
 * O localStorage atua somente como apoio visual para evitar flash de estilo.
 */
function SettingsThemeSync() {
  const { data: settings } = useSettings();
  const { setAccent } = useTheme();

  useEffect(() => {
    if (settings?.accent && ACCENTS.some((a) => a.id === settings.accent)) {
      setAccent(settings.accent as AccentId);
    }
  }, [settings?.accent, setAccent]);

  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [accent, setAccent] = useState<AccentId>("indigo");

  useEffect(() => {
    const savedMode = localStorage.getItem("theme-mode") as ThemeMode | null;
    const savedAccent = localStorage.getItem("theme-accent") as AccentId | null;
    if (savedMode) setMode(savedMode);
    if (savedAccent && ACCENTS.some((a) => a.id === savedAccent)) {
      setAccent(savedAccent);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
    localStorage.setItem("theme-mode", mode);
  }, [mode]);

  useEffect(() => {
    const found = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0];
    document.documentElement.style.setProperty("--primary-hue", String(found.hue));
    document.documentElement.style.setProperty("--primary-chroma", String(found.chroma));
    localStorage.setItem("theme-accent", accent);
  }, [accent]);

  return (
    <ThemeContext.Provider value={{ mode, accent, setMode, setAccent }}>
      <SettingsThemeSync />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
