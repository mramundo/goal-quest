import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Crown,
  Medal,
  Plus,
  Trophy,
  History,
  Scroll,
  Sparkles,
  Swords,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Badge } from "@/components/ui/Badge";
import { Input, Label } from "@/components/ui/Input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import {
  AwardBadge,
  GoalIconView,
  RewardIconView,
} from "@/components/ui/MedievalIcon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import type {
  Goal,
  GoalParticipantSummary,
  Group,
  ProgressEntry,
} from "@/types";
import { getGoal, getGroup, logProgress, upsertUser } from "@/lib/db";
import { leaderboardForGoal, userProgressOnGoal } from "@/lib/queries";
import { useAuth } from "@/store/auth";
import { clamp, cn, formatRelative, uid } from "@/lib/utils";

export function GoalDetailPage() {
  const { goalId } = useParams<{ goalId: string }>();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [leaderboard, setLeaderboard] = useState<GoalParticipantSummary[]>([]);
  const [myPoints, setMyPoints] = useState(0);
  const [myEntries, setMyEntries] = useState<ProgressEntry[]>([]);
  const [celebrate, setCelebrate] = useState<{
    title: string;
    description: string;
    icon: string;
  } | null>(null);

  async function reload(g: Goal) {
    if (!user) return;
    const [lb, mine] = await Promise.all([
      leaderboardForGoal(g),
      userProgressOnGoal(g, user.id),
    ]);
    setLeaderboard(lb);
    setMyPoints(mine.points);
    setMyEntries(mine.entries);
  }

  useEffect(() => {
    if (!goalId) return;
    (async () => {
      const g = await getGoal(goalId);
      if (!g) {
        navigate("/", { replace: true });
        return;
      }
      const gr = await getGroup(g.groupId);
      setGoal(g);
      setGroup(gr ?? null);
      await reload(g);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId, user?.id]);

  async function onLog(action: string, points: number) {
    if (!user || !goal) return;
    const clamped = clamp(points, 1, 100 - myPoints);
    if (clamped <= 0) {
      toast.info("Hai già raggiunto i 100 punti, vai a rivendicare il forziere!");
      return;
    }
    const newTotal = myPoints + clamped;
    const entry: ProgressEntry = {
      id: uid("prg"),
      goalId: goal.id,
      userId: user.id,
      action,
      points: clamped,
      totalAfter: newTotal,
      createdAt: new Date().toISOString(),
    };
    try {
      await logProgress(entry);
      const unlocked = goal.milestones.find(
        (m) => myPoints < m.points && newTotal >= m.points
      );
      const finalUnlocked = myPoints < 100 && newTotal >= 100;

      if (finalUnlocked) {
        setCelebrate({
          title: goal.finalReward.title,
          description: goal.finalReward.description,
          icon: goal.finalReward.icon,
        });
      } else if (unlocked) {
        setCelebrate({
          title: unlocked.reward.title || unlocked.title,
          description: unlocked.reward.description,
          icon: unlocked.reward.icon,
        });
      } else {
        toast.success(`+${clamped}pt · ${action}`);
      }

      // Aggiorna XP dell'utente (usiamo i punti come XP)
      const updated = { ...user, totalXp: (user.totalXp ?? 0) + clamped };
      await upsertUser(updated, `chore(user): +${clamped}xp ${user.username}`);
      setUser(updated);

      await reload(goal);
    } catch (err) {
      console.error(err);
      toast.error("Impossibile loggare i progressi.");
    }
  }

  if (!goal || !group || !user) return null;

  const myRank = leaderboard.findIndex((p) => p.userId === user.id) + 1;
  const nextMilestone = goal.milestones.find((m) => myPoints < m.points);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={`/groups/${group.id}`}>
          <ArrowLeft className="h-4 w-4" /> {group.name}
        </Link>
      </Button>

      {/* Header */}
      <Card>
        <div className="p-5 md:p-7 flex flex-col md:flex-row gap-4">
          <div className="h-16 w-16 rounded-lg medieval-border bg-muted/60 text-primary flex items-center justify-center shrink-0">
            <GoalIconView name={goal.icon} size={32} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-display leading-tight">{goal.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="muted">
                <Swords className="h-3 w-3" />
                {leaderboard.length}{" "}
                {leaderboard.length === 1 ? "avventuriero" : "avventurieri"}
              </Badge>
              <Badge variant="muted">
                <Trophy className="h-3 w-3" />
                {goal.milestones.length} tappe
              </Badge>
              {goal.deadline && (
                <Badge variant="muted">
                  Scadenza {new Date(goal.deadline).toLocaleDateString("it-IT")}
                </Badge>
              )}
              {myRank > 0 && (
                <Badge variant="gold">
                  <Crown className="h-3 w-3" /> Sei {myRank}° in classifica
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* My progress */}
        <div className="p-5 md:p-7 pt-0 md:pt-0 border-t border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-display uppercase tracking-widest text-muted-foreground">
              La tua quest
            </p>
            <LogProgressDialog goal={goal} onLog={onLog} currentPoints={myPoints} />
          </div>
          <Progress value={myPoints} size="lg" showLabel />
          <p className="text-xs text-muted-foreground mt-2">
            {myPoints >= 100 ? (
              <span className="text-accent">
                🏆 Hai conquistato il forziere finale: {goal.finalReward.title}
              </span>
            ) : nextMilestone ? (
              <>
                Prossima tappa: <strong>{nextMilestone.title}</strong> a {nextMilestone.points}pt ·
                mancano <strong>{nextMilestone.points - myPoints}</strong> punti al premio
                &laquo;{nextMilestone.reward.title || "da scoprire"}&raquo;.
              </>
            ) : (
              <>Lancia l'ultimo attacco: mancano {100 - myPoints} punti al forziere!</>
            )}
          </p>
        </div>
      </Card>

      <Tabs defaultValue="milestones">
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="milestones" className="flex-1 md:flex-none">
            <Medal className="h-4 w-4 mr-1" /> Tappe
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="flex-1 md:flex-none">
            <Crown className="h-4 w-4 mr-1" /> Classifica
          </TabsTrigger>
          <TabsTrigger value="log" className="flex-1 md:flex-none">
            <History className="h-4 w-4 mr-1" /> Diario
          </TabsTrigger>
        </TabsList>

        <TabsContent value="milestones" className="mt-4">
          <div className="space-y-3">
            {goal.milestones
              .slice()
              .sort((a, b) => a.points - b.points)
              .map((m) => {
                const unlocked = myPoints >= m.points;
                return (
                  <Card key={m.id} className={cn(unlocked && "ring-1 ring-accent/70")}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div
                        className={cn(
                          "h-12 w-12 rounded-md medieval-border flex items-center justify-center",
                          unlocked
                            ? "bg-accent/20 text-accent"
                            : "bg-muted/50 text-muted-foreground"
                        )}
                      >
                        <RewardIconView name={m.reward.icon} size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-display text-lg leading-tight truncate">
                            {m.title}
                          </p>
                          <Badge variant={unlocked ? "gold" : "muted"}>{m.points}pt</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          <span className="font-medium text-foreground">
                            {m.reward.title || "Premio da definire"}
                          </span>
                          {m.reward.description && ` · ${m.reward.description}`}
                        </p>
                      </div>
                      {unlocked && <Badge variant="success">Sbloccato</Badge>}
                    </CardContent>
                  </Card>
                );
              })}

            {/* Final */}
            <Card className={cn(myPoints >= 100 && "ring-2 ring-accent")}>
              <CardContent className="p-5 flex items-center gap-4 bg-[linear-gradient(135deg,hsl(var(--accent)/0.12),transparent)]">
                <div className="h-14 w-14 rounded-full bg-[linear-gradient(135deg,hsl(var(--accent)),hsl(var(--primary)))] text-background medieval-border flex items-center justify-center">
                  <RewardIconView name={goal.finalReward.icon} size={26} />
                </div>
                <div className="flex-1">
                  <p className="font-display text-xl gold-text">
                    {goal.finalReward.title || "Forziere leggendario"}
                  </p>
                  {goal.finalReward.description && (
                    <p className="text-sm text-muted-foreground">
                      {goal.finalReward.description}
                    </p>
                  )}
                </div>
                <Badge variant="gold">100pt</Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4">
          <Leaderboard list={leaderboard} currentUserId={user.id} goal={goal} />
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <ProgressLog entries={myEntries} />
        </TabsContent>
      </Tabs>

      <AnimatePresence>
        {celebrate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setCelebrate(null)}
          >
            <motion.div
              initial={{ scale: 0.6, rotate: -8, y: 60 }}
              animate={{ scale: 1, rotate: 0, y: 0 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="parchment medieval-border rounded-xl p-8 max-w-sm text-center shadow-medieval"
            >
              <div className="relative mb-4">
                <div className="absolute inset-0 rounded-full blur-2xl bg-accent/40 animate-float" />
                <div className="relative h-24 w-24 mx-auto rounded-full bg-[linear-gradient(135deg,hsl(var(--accent)),hsl(var(--primary)))] text-background medieval-border flex items-center justify-center">
                  <RewardIconView
                    name={celebrate.icon as never}
                    size={48}
                  />
                </div>
              </div>
              <p className="text-xs font-display uppercase tracking-widest text-muted-foreground">
                <Sparkles className="inline h-3.5 w-3.5 mr-1 text-accent" />
                Premio sbloccato
              </p>
              <h3 className="text-2xl font-display gold-text mt-1">{celebrate.title}</h3>
              {celebrate.description && (
                <p className="text-sm text-muted-foreground mt-1">{celebrate.description}</p>
              )}
              <Button
                className="mt-5"
                variant="gold"
                onClick={() => setCelebrate(null)}
              >
                Continua la quest
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LogProgressDialog({
  goal,
  onLog,
  currentPoints,
}: {
  goal: Goal;
  onLog: (action: string, points: number) => Promise<void>;
  currentPoints: number;
}) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState("");
  const [points, setPoints] = useState(3);
  const [busy, setBusy] = useState(false);

  const presets = useMemo(() => goal.actionPresets ?? [], [goal]);
  const remaining = 100 - currentPoints;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!action.trim() || points < 1) return;
    setBusy(true);
    await onLog(action.trim(), points);
    setBusy(false);
    setOpen(false);
    setAction("");
    setPoints(3);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gold" size="sm" disabled={remaining <= 0}>
          <Plus className="h-4 w-4" /> Logga progressi
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registra un'azione</DialogTitle>
          <DialogDescription>
            Racconta cosa hai fatto e quanti punti vale. Massimo {remaining}pt rimasti.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {presets.length > 0 && (
            <div className="space-y-1.5">
              <Label>Preset rapidi</Label>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      setAction(p.label);
                      setPoints(clamp(p.points, 1, remaining));
                    }}
                    className="px-3 py-1.5 rounded-full medieval-border bg-muted/60 hover:bg-muted text-sm"
                  >
                    {p.label}
                    <span className="ml-1 text-accent font-display">+{p.points}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="action">Azione compiuta</Label>
            <Input
              id="action"
              required
              maxLength={120}
              placeholder="es. Corsa 5 km al parco"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="points">Punti valore</Label>
              <Badge variant="gold">+{points}pt</Badge>
            </div>
            <input
              id="points"
              type="range"
              min={1}
              max={Math.max(1, remaining)}
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              className="w-full accent-[hsl(var(--accent))]"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-display tracking-wider">
              <span>1</span>
              <span>{Math.max(1, remaining)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" variant="gold" className="flex-1" disabled={busy}>
              {busy ? "Registro..." : "Conferma"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Leaderboard({
  list,
  currentUserId,
  goal,
}: {
  list: GoalParticipantSummary[];
  currentUserId: string;
  goal: Goal;
}) {
  if (list.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Scroll className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="font-display text-lg">Pergamena ancora bianca</p>
          <p className="text-sm text-muted-foreground">
            Nessuno ha ancora loggato progressi. Sii tu il primo a scrivere la leggenda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {list.map((p, idx) => {
        const isMe = p.userId === currentUserId;
        return (
          <Card
            key={p.userId}
            className={cn(
              "overflow-hidden",
              isMe && "ring-1 ring-accent/70",
              idx === 0 && "bg-[linear-gradient(135deg,hsl(var(--accent)/0.1),transparent)]"
            )}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <RankBadge rank={idx + 1} />
              <div className="h-10 w-10 rounded-full bg-[linear-gradient(135deg,hsl(var(--accent)),hsl(var(--primary)))] text-background font-display text-lg flex items-center justify-center shrink-0">
                {p.displayName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-display leading-tight truncate">
                    {p.displayName}
                    {isMe && <span className="ml-2 text-[10px] text-accent">(tu)</span>}
                  </p>
                  {p.finalUnlocked && (
                    <Badge variant="gold">
                      <Trophy className="h-3 w-3" /> Vincitore
                    </Badge>
                  )}
                </div>
                <Progress value={p.points} size="sm" className="mt-1" />
              </div>
              <div className="text-right shrink-0">
                <p className="font-display text-xl gold-text">{p.points}</p>
                <p className="text-[10px] text-muted-foreground">
                  {p.unlockedMilestones.length}/{goal.milestones.length} tappe
                </p>
              </div>
              <AwardBadge unlocked={p.finalUnlocked} size={32} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const styles =
    rank === 1
      ? "bg-[linear-gradient(135deg,#facc15,#b45309)] text-white"
      : rank === 2
      ? "bg-[linear-gradient(135deg,#e5e7eb,#94a3b8)] text-slate-800"
      : rank === 3
      ? "bg-[linear-gradient(135deg,#f59e0b,#78350f)] text-white"
      : "bg-muted text-muted-foreground";
  return (
    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center font-display text-sm medieval-border shrink-0", styles)}>
      {rank}
    </div>
  );
}

function ProgressLog({ entries }: { entries: ProgressEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Il tuo diario è ancora vuoto</CardTitle>
          <CardDescription>
            Ogni volta che loggi un'azione, la tua storia si riempie di pagine epiche.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
      <ul className="space-y-3">
        {entries
          .slice()
          .reverse()
          .map((e) => (
            <li key={e.id} className="relative">
              <div className="absolute -left-[18px] top-3 h-3 w-3 rounded-full bg-accent medieval-border" />
              <Card>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium">{e.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelative(e.createdAt)} · Tot: {e.totalAfter}/100
                    </p>
                  </div>
                  <Badge variant="gold">+{e.points}</Badge>
                </CardContent>
              </Card>
            </li>
          ))}
      </ul>
    </div>
  );
}
