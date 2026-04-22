import { useEffect } from "react";
import { useTheme } from "@/store/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, mode } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    if (mode === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    // Ricolora la metatag theme-color in base allo sfondo effettivo
    const css = getComputedStyle(root);
    const bg = css.getPropertyValue("--background");
    if (bg) {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", `hsl(${bg})`);
    }
  }, [theme, mode]);

  return <>{children}</>;
}
