import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Scroll, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { githubIssueUrl } from "@/lib/config";
import { sha256 } from "@/lib/utils";

/**
 * Richiesta accesso: compila un form e apri una issue GitHub con i dati
 * pre-compilati. L'admin vedrà la issue e creerà l'utente nei JSON.
 *
 * Il PIN viene inviato come hash (SHA-256) così l'admin non lo legge in chiaro:
 * l'utente lo conserva e lo usa al login.
 */
export function RegisterPage() {
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    email: "",
    reason: "",
    desiredPin: "",
  });
  const [hash, setHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const h = await sha256(form.desiredPin);
    setHash(h);
    const url = githubIssueUrl({
      title: `[Access] ${form.username}`,
      "username": form.username,
      "display-name": form.displayName,
      "email": form.email,
      "reason": form.reason,
      "pin-hash": h,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyHash() {
    if (!hash) return;
    await navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="flex items-center justify-between p-4 max-w-5xl mx-auto w-full">
        <Link to="/login" className="font-display tracking-widest gold-text text-xl">
          Goal Quest
        </Link>
        <ThemeSwitcher />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-6">
        <Card className="w-full max-w-xl">
          <CardHeader className="items-center text-center">
            <Scroll className="h-14 w-14 text-accent" />
            <CardTitle className="text-3xl gold-text">Richiedi accesso</CardTitle>
            <CardDescription>
              Compila la pergamena e il corvo la porterà al Sovrano (apre una issue GitHub).
              Sarai ammesso non appena approverà la tua richiesta.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    required
                    minLength={3}
                    pattern="^[a-zA-Z0-9_\-]+$"
                    title="Lettere, numeri, _ e -"
                    placeholder="merlino42"
                    value={form.username}
                    onChange={(e) => update("username", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Nome in-game</Label>
                  <Input
                    id="displayName"
                    required
                    placeholder="Merlino il Saggio"
                    value={form.displayName}
                    onChange={(e) => update("displayName", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Piccione viaggiatore (email)</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="tu@regno.it"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reason">Motivo della quest</Label>
                <Textarea
                  id="reason"
                  required
                  placeholder="Cosa vuoi ottenere? Quali obiettivi pensi di perseguire?"
                  value={form.reason}
                  onChange={(e) => update("reason", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pin">Sigillo segreto (PIN min 4 cifre)</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  required
                  minLength={4}
                  placeholder="• • • •"
                  value={form.desiredPin}
                  onChange={(e) => update("desiredPin", e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Solo l'hash viene inviato. Ricorda il PIN: ti servirà per entrare.
                </p>
              </div>

              <Button type="submit" variant="gold" size="lg" className="w-full">
                <ExternalLink className="h-4 w-4" />
                Apri la richiesta su GitHub
              </Button>
            </form>

            {hash && (
              <div className="mt-6 p-4 rounded-md bg-muted/60 medieval-border">
                <p className="text-xs text-muted-foreground mb-2">
                  Se la issue non si è aperta, copia l'hash del tuo PIN e aggiungilo manualmente:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[10px] break-all font-mono bg-card rounded px-2 py-1.5 medieval-border">
                    {hash}
                  </code>
                  <Button type="button" size="icon" variant="ghost" onClick={copyHash}>
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Sei già dei nostri?{" "}
              <Link to="/login" className="text-accent font-display tracking-wide hover:underline">
                Torna al ponte levatoio
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
