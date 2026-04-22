import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Compass, Flame, Trophy, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { Badge } from "@/components/ui/Badge";
import { AwardBadge, GoalIconView, GroupIconView } from "@/components/ui/MedievalIcon";
import { useAuth } from "@/store/auth";
import type { Goal, Group } from "@/types";
import { userGoals, userGroups, userProgressOnGoal } from "@/lib/queries";
import { levelForXp, titleForXp, formatRelative, clamp } from "@/lib/utils";

export function DashboardPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [goals, setGoals] = useState<Array<Goal & { points: number; lastActivity?: string }>>(
    []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [gs, goalsList] = await Promise.all([userGroups(user.id), userGoals(user.id)]);
      const enriched = await Promise.all(
        goalsList.map(async (g) => {
          const prog = await userProgressOnGoal(g, user.id);
          return { ...g, points: prog.points, lastActivity: prog.lastActivity };
        })
      );
      enriched.sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""));
      setGroups(gs);
      setGoals(enriched);
      setLoading(false);
    })();
  }, [user]);

  if (!user) return null;

  const xp = user.totalXp ?? 0;
  const level = levelForXp(xp);
  const title = titleForXp(xp);
  const nextLevelXp = Math.pow(level, 2) * 25;
  const prevLevelXp = Math.pow(level - 1, 2) * 25;
  const progressToNext = clamp(((xp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100, 0, 100);

  const activeGoals = goals.filter((g) => g.points < 100).slice(0, 4);
  const completedGoals = goals.filter((g) => g.points >= 100).length;
  const unlockedMilestones = goals.reduce(
    (s, g) => s + g.milestones.filter((m) => g.points >= m.points).length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Hero: player card */}
      <Card className="overflow-visible">
        <div className="p-5 md:p-7 flex flex-col md:flex-row md:items-center gap-5">
          <div className="relative">
            <div className="absolute -inset-2 rounded-full blur-2xl bg-accent/30 -z-10" />
            <div className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-[linear-gradient(135deg,hsl(var(--accent)),hsl(var(--primary)))] flex items-center justify-center medieval-border text-background font-display text-3xl uppercase">
              {user.displayName.charAt(0)}
            </div>
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-display tracking-wider uppercase bg-card medieval-border">
              Lv {level}
            </span>
          </div>

          <div className="flex-1">
            <p className="text-xs font-display uppercase tracking-widest text-muted-foreground">
              Benvenuto di nuovo
            </p>
            <h1 className="text-2xl md:text-3xl font-display leading-tight">
              {user.displayName}
            </h1>
            <p className="gold-text text-sm font-display tracking-wide mt-0.5">
              {title}
            </p>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>XP totale</span>
                <span>
                  {xp} / {nextLevelXp} → Lv {level + 1}
                </span>
              </div>
              <Progress value={progressToNext} size="md" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 md:gap-3 text-center">
            <Stat icon={<Compass className="h-4 w-4" />} label="Gilde" value={groups.length} />
            <Stat icon={<Flame className="h-4 w-4" />} label="Milestone" value={unlockedMilestones} />
            <Stat icon={<Trophy className="h-4 w-4" />} label="Quest vinte" value={completedGoals} />
          </div>
        </div>
      </Card>

      {/* Active goals */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-display flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" /> Le tue quest attive
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/groups">
              Tutte le gilde <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>

        {loading ? (
          <SkeletonList />
        ) : activeGoals.length === 0 ? (
          <EmptyState
            title="Nessuna quest in corso"
            subtitle="Unisciti a una gilda o crea un nuovo obiettivo per iniziare."
            cta={{ to: "/groups", label: "Esplora le gilde" }}
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {activeGoals.map((g) => (
              <ActiveGoalCard key={g.id} goal={g} />
            ))}
          </div>
        )}
      </section>

      {/* Groups */}
      <section className="space-y-3">
        <h2 className="text-xl font-display flex items-center gap-2">
          <Compass className="h-5 w-5 text-primary" /> Le tue gilde
        </h2>

        {loading ? (
          <SkeletonList />
        ) : groups.length === 0 ? (
          <EmptyState
            title="Non sei ancora in una gilda"
            subtitle="Unisciti a una gilda esistente o fondane una tua."
            cta={{ to: "/groups", label: "Vai alle gilde" }}
          />
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {groups.map((g) => (
              <Link key={g.id} to={`/groups/${g.id}`} className="group">
                <Card className="h-full transition-transform group-hover:-translate-y-0.5 group-hover:shadow-medieval">
                  <CardContent className="p-5 flex items-center gap-3">
                    <div className="h-11 w-11 flex items-center justify-center rounded-md medieval-border bg-muted/60 text-primary">
                      <GroupIconView name={g.icon} size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-lg leading-tight truncate">{g.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{g.description}</p>
                    </div>
                    <Badge variant={g.isPublic ? "success" : "muted"}>
                      {g.isPublic ? "Pubblico" : "Privato"}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/50 medieval-border px-2 py-2">
      <div className="text-accent flex items-center justify-center">{icon}</div>
      <div className="text-xl font-display mt-0.5">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function ActiveGoalCard({ goal }: { goal: Goal & { points: number; lastActivity?: string } }) {
  const nextMilestone = goal.milestones.find((m) => goal.points < m.points);
  return (
    <Link to={`/goals/${goal.id}`} className="group">
      <Card className="h-full transition-transform group-hover:-translate-y-0.5">
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 flex items-center justify-center rounded-md medieval-border bg-muted/60 text-primary">
              <GoalIconView name={goal.icon} size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{goal.title}</CardTitle>
              <CardDescription className="line-clamp-1">{goal.description}</CardDescription>
            </div>
            <AwardBadge unlocked={goal.points >= 100} size={28} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={goal.points} showLabel />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {nextMilestone
                ? `Prossima tappa: ${nextMilestone.title} (${nextMilestone.points}pt)`
                : "Forziere finale in vista!"}
            </span>
            {goal.lastActivity && <span>• {formatRelative(goal.lastActivity)}</span>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SkeletonList() {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {[0, 1].map((i) => (
        <div key={i} className="h-28 rounded-lg bg-muted/40 animate-pulse medieval-border" />
      ))}
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
  cta,
}: {
  title: string;
  subtitle: string;
  cta: { to: string; label: string };
}) {
  return (
    <Card>
      <CardContent className="p-8 text-center space-y-3">
        <p className="font-display text-lg">{title}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
        <Button asChild variant="gold">
          <Link to={cta.to}>{cta.label}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
