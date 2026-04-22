import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Moon, Palette, Sun } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { THEMES, useTheme } from "@/store/theme";
import { cn } from "@/lib/utils";

export function ThemeSwitcher() {
  const { theme, mode, setTheme, toggleMode } = useTheme();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMode}
        aria-label="Alterna luce/buio"
        title={mode === "light" ? "Passa alla notte" : "Passa al giorno"}
      >
        {mode === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </Button>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="icon" aria-label="Cambia tema">
            <Palette className="h-5 w-5" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="parchment rounded-md medieval-border p-1 min-w-[220px] shadow-medieval z-50"
          >
            <DropdownMenu.Label className="px-2 py-1.5 text-[10px] font-display uppercase tracking-widest text-muted-foreground">
              Palette
            </DropdownMenu.Label>
            {THEMES.map((t) => (
              <DropdownMenu.Item
                key={t.id}
                onSelect={() => setTheme(t.id)}
                className={cn(
                  "flex items-center gap-2 px-2 py-2 rounded text-sm cursor-pointer outline-none",
                  "data-[highlighted]:bg-muted/60",
                  theme === t.id && "bg-accent/20"
                )}
              >
                <span className="text-lg">{t.emoji}</span>
                <span className="flex-1">
                  <span className="font-display tracking-wide">{t.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{t.hint}</span>
                </span>
                {theme === t.id && (
                  <span className="text-[10px] text-accent-foreground font-display">✓</span>
                )}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
