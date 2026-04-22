import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeMode, ThemeName } from "@/types";

interface ThemeState {
  theme: ThemeName;
  mode: ThemeMode;
  setTheme: (theme: ThemeName) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "parchment",
      mode:
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light",
      setTheme(theme) {
        set({ theme });
      },
      setMode(mode) {
        set({ mode });
      },
      toggleMode() {
        set((s) => ({ mode: s.mode === "light" ? "dark" : "light" }));
      },
    }),
    { name: "goalquest:theme" }
  )
);

export const THEMES: { id: ThemeName; label: string; emoji: string; hint: string }[] = [
  { id: "parchment", label: "Pergamena", emoji: "📜", hint: "Avorio, oro antico, bordeaux" },
  { id: "tavern", label: "Taverna", emoji: "🍺", hint: "Legno scuro, oro, brace" },
  { id: "forest", label: "Foresta Elfica", emoji: "🌿", hint: "Verdi muschio, oro" },
  { id: "ice", label: "Regno di Ghiaccio", emoji: "❄️", hint: "Blu artico, argento, ciano" },
];
