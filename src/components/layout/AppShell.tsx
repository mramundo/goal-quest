import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Shield, LogOut, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { useAuth } from "@/store/auth";
import { cn, levelForXp, titleForXp } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Portico", icon: Home },
  { to: "/groups", label: "Gilde", icon: Users },
  { to: "/profile", label: "Diario", icon: Shield },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const xp = user?.totalXp ?? 0;
  const level = levelForXp(xp);
  const title = titleForXp(xp);

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 group"
            aria-label="Goal Quest home"
          >
            <svg viewBox="0 0 48 48" width="32" height="32" fill="none" className="text-primary drop-shadow">
              <path d="M24 4 L34 14 L38 14 L38 22 L44 22 L36 32 L30 30 L28 38 L20 38 L18 30 L12 32 L4 22 L10 22 L10 14 L14 14 Z" fill="currentColor" opacity="0.95"/>
              <circle cx="24" cy="22" r="4" fill="hsl(var(--background))" />
            </svg>
            <span className="font-display text-lg tracking-wide gold-text hidden sm:block">
              Goal Quest
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-1 ml-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-display tracking-wide uppercase",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user && (
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <span className="text-xs font-display tracking-wider uppercase text-muted-foreground">
                  {title} · Lv {level}
                </span>
                <span className="text-sm font-medium">{user.displayName}</span>
              </div>
            )}
            <ThemeSwitcher />
            {user && (
              <Button variant="ghost" size="icon" onClick={logout} aria-label="Esci dal regno">
                <LogOut className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6 pb-24 md:pb-10">
        <Outlet />
      </main>

      {/* Bottom navigation per mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/90 backdrop-blur-md safe-bottom">
        <div className="grid grid-cols-3 max-w-5xl mx-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-display uppercase tracking-wider",
                  isActive ? "text-accent" : "text-muted-foreground"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
