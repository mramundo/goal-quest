import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Lock, Globe2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardDescription, CardFooter, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { GROUP_ICONS, GroupIconView } from "@/components/ui/MedievalIcon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { Label, Textarea } from "@/components/ui/Input";
import type { Group, GroupIcon } from "@/types";
import { addMembership, createGroup, groupsOfUser, listGroups } from "@/lib/db";
import { useAuth } from "@/store/auth";
import { sha256, uid, cn } from "@/lib/utils";

export function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [all, mine] = await Promise.all([listGroups(), groupsOfUser(user.id)]);
    setGroups(all);
    setMemberIds(new Set(mine));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(s) ||
        g.description.toLowerCase().includes(s)
    );
  }, [groups, search]);

  async function handleJoin(group: Group) {
    if (!user) return;
    if (memberIds.has(group.id)) return;

    if (!group.isPublic) {
      const pin = prompt(`🔒 Gilda privata "${group.name}". Inserisci il PIN:`);
      if (!pin) return;
      const h = await sha256(pin);
      if (h !== group.pinHash) {
        toast.error("PIN errato, il portone resta chiuso.");
        return;
      }
    }

    await addMembership({
      userId: user.id,
      groupId: group.id,
      joinedAt: new Date().toISOString(),
    });
    toast.success(`Benvenuto nella gilda ${group.name}!`);
    await load();
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div>
          <h1 className="text-3xl font-display flex items-center gap-2">
            <Users className="h-7 w-7 text-accent" />
            Le Gilde
          </h1>
          <p className="text-sm text-muted-foreground">
            Unisciti a una gilda esistente o fondane una nuova per riunire chi insegue i tuoi
            stessi obiettivi.
          </p>
        </div>

        <CreateGroupDialog onCreated={load} />
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca una gilda..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-lg bg-muted/40 medieval-border animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <p className="font-display text-lg">Nessuna gilda trovata</p>
            <p className="text-sm text-muted-foreground">
              Sii il primo: fonda una gilda a tuo nome.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              joined={memberIds.has(g.id)}
              onJoin={() => handleJoin(g)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupCard({
  group,
  joined,
  onJoin,
}: {
  group: Group;
  joined: boolean;
  onJoin: () => void;
}) {
  return (
    <Card className={cn("flex flex-col", joined && "ring-1 ring-accent/60")}>
      <CardContent className="p-5 flex items-start gap-3 flex-1">
        <div className="h-12 w-12 flex items-center justify-center rounded-md medieval-border bg-muted/60 text-primary shrink-0">
          <GroupIconView name={group.icon} size={26} />
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-lg truncate">{group.name}</CardTitle>
          <CardDescription className="line-clamp-2 mt-0.5">
            {group.description}
          </CardDescription>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {group.isPublic ? (
              <Badge variant="success">
                <Globe2 className="h-3 w-3" />
                Pubblico
              </Badge>
            ) : (
              <Badge variant="muted">
                <Lock className="h-3 w-3" />
                Privato
              </Badge>
            )}
            {joined && <Badge variant="gold">Membro</Badge>}
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        {joined ? (
          <Button asChild variant="outline" size="sm">
            <Link to={`/groups/${group.id}`}>Entra</Link>
          </Button>
        ) : (
          <Button size="sm" variant="gold" onClick={onJoin}>
            Unisciti
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function CreateGroupDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    icon: "castle" as GroupIcon,
    isPublic: true,
    pin: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.isPublic && form.pin.length < 4) {
      toast.error("Il PIN deve avere almeno 4 cifre.");
      return;
    }
    setBusy(true);
    try {
      const group: Group = {
        id: uid("grp"),
        name: form.name.trim(),
        description: form.description.trim(),
        icon: form.icon,
        isPublic: form.isPublic,
        pinHash: form.isPublic ? undefined : await sha256(form.pin),
        ownerId: user.id,
        createdAt: new Date().toISOString(),
      };
      await createGroup(group);
      await addMembership({
        userId: user.id,
        groupId: group.id,
        joinedAt: new Date().toISOString(),
      });
      toast.success(`Gilda "${group.name}" fondata!`);
      setOpen(false);
      setForm({ name: "", description: "", icon: "castle", isPublic: true, pin: "" });
      onCreated();
    } catch (err) {
      console.error(err);
      toast.error("Non sono riuscito a fondare la gilda. Verifica il token.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gold" size="md">
          <Plus className="h-4 w-4" />
          Fonda una gilda
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fonda la tua gilda</DialogTitle>
          <DialogDescription>
            Crea uno spazio tematico dove accogliere i compagni della stessa quest.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="g-name">Nome della gilda</Label>
            <Input
              id="g-name"
              required
              maxLength={40}
              placeholder="es. Sentinelle dell'Alba"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-desc">Motto / descrizione</Label>
            <Textarea
              id="g-desc"
              required
              maxLength={160}
              placeholder="Cosa unisce i membri? Qual è l'ethos?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sigillo (icona)</Label>
            <div className="grid grid-cols-8 gap-2">
              {GROUP_ICONS.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  onClick={() => setForm({ ...form, icon: ic })}
                  className={cn(
                    "aspect-square rounded-md medieval-border flex items-center justify-center",
                    form.icon === ic
                      ? "bg-accent/25 text-accent"
                      : "bg-muted/40 text-foreground hover:bg-muted/60"
                  )}
                  aria-label={`Icona ${ic}`}
                >
                  <GroupIconView name={ic} size={20} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Visibilità</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, isPublic: true })}
                className={cn(
                  "flex items-start gap-2 p-3 rounded-md medieval-border text-left",
                  form.isPublic ? "bg-accent/20" : "bg-muted/40"
                )}
              >
                <Globe2 className="h-4 w-4 mt-0.5 text-accent" />
                <div>
                  <p className="font-display text-sm">Pubblica</p>
                  <p className="text-[11px] text-muted-foreground">Chiunque può unirsi.</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, isPublic: false })}
                className={cn(
                  "flex items-start gap-2 p-3 rounded-md medieval-border text-left",
                  !form.isPublic ? "bg-accent/20" : "bg-muted/40"
                )}
              >
                <Lock className="h-4 w-4 mt-0.5 text-accent" />
                <div>
                  <p className="font-display text-sm">Privata</p>
                  <p className="text-[11px] text-muted-foreground">Serve un PIN per entrare.</p>
                </div>
              </button>
            </div>

            {!form.isPublic && (
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="g-pin">PIN</Label>
                <Input
                  id="g-pin"
                  type="password"
                  inputMode="numeric"
                  minLength={4}
                  placeholder="• • • •"
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Annulla
            </Button>
            <Button type="submit" variant="gold" className="flex-1" disabled={busy}>
              {busy ? "Sto forgiando..." : "Fonda la gilda"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
