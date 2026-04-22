import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Shield, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { useAuth } from "@/store/auth";
import { config } from "@/lib/config";

export function LoginPage() {
  const { login, loading, error } = useAuth();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await login(username, pin);
    if (ok) navigate(location.state?.from ?? "/", { replace: true });
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="flex items-center justify-between p-4 max-w-5xl mx-auto w-full">
        <span className="font-display tracking-widest gold-text text-xl">Goal Quest</span>
        <ThemeSwitcher />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-6">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <div className="relative mb-2">
              <div className="absolute inset-0 rounded-full blur-xl bg-accent/30 animate-float" />
              <Shield className="relative h-14 w-14 text-accent drop-shadow" />
            </div>
            <CardTitle className="text-3xl gold-text">Entra nel Regno</CardTitle>
            <CardDescription>
              Varca la porta della fortezza con il tuo nome e il tuo PIN.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Nome del cavaliere</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  placeholder="es. artù_pendragon"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pin">Sigillo (PIN)</Label>
                <div className="relative">
                  <Input
                    id="pin"
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    autoComplete="current-password"
                    placeholder="• • • •"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    required
                    minLength={4}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
                    aria-label={showPin ? "Nascondi PIN" : "Mostra PIN"}
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive font-medium" role="alert">
                  ⚔ {error}
                </p>
              )}

              <Button
                type="submit"
                variant="gold"
                size="lg"
                className="w-full"
                disabled={loading || !username || pin.length < 4}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    In marcia...
                  </>
                ) : (
                  "Prosegui la Quest"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Ancora senza invito?{" "}
              <Link to="/register" className="text-accent font-display tracking-wide hover:underline">
                Richiedi accesso al Regno
              </Link>
            </div>

            {config.demoMode && (
              <p className="mt-4 text-center text-[11px] text-muted-foreground/80 leading-relaxed">
                Modalità demo: nessun token GitHub configurato. Gli utenti sono caricati dai JSON
                nel repo, le modifiche restano solo nel tuo browser.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
