import { useEffect, useState } from "react";
import { Shield, Sparkles, Trophy, Crown, BookHeart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Badge } from "@/components/ui/Badge";
import { AwardBadge, GoalIconView } from "@/components/ui/MedievalIcon";
import type { Goal } from "@/types";
import { userGoals, userGroups, userProgressOnGoal } from "@/lib/queries";
import { useAuth } from "@/store/auth";
import { formatRelative, levelForXp, titleForXp, clamp } from "@/lib/utils";
import { Link } from "react-router-dom";

export function ProfilePage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<
    Array<Goal & { points: number; lastActivity?: string }>
  >([]);
  const [groupsCount, setGroupsCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [gs, groups] = await Promise.all([userGoals(user.id), userGroups(user.id)]);
      const enriched = await Promise.all(
        gs.map(async (g) => {
          const p = await userProgressOnGoal(g, user.id);
          return { ...g, points: p.points, lastActivity: p.lastActivity };
        })
      );
      enriched.sort((a, b) => b.points - a.points);
      setGoals(enriched);
      setGroupsCount(groups.length);
    })();
  }, [user]);

  if (!user) return null;

  const xp = user.totalXp ?? 0;
  const level = levelForXp(xp);
  const title = titleForXp(xp);
  const nextLevelXp = Math.pow(level, 2) * 25;
  const prevLevelXp = Math.pow(level - 1, 2) * 25;
  const progressToNext = clamp(((xp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100, 0, 100);

  const completed = goals.filter((g) => g.points >= 100);
  const inProgress = goals.filter((g) => g.points < 100);
  const unlockedMilestones = goals.reduce(
    (s, g) => s + g.milestones.filter((m) => g.points >= m.points).length,
    0
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5 md:p-7 flex flex-col md:flex-row md:items-center gap-5">
          <div className="relative">
            <div className="absolute -inset-2 rounded-full blur-2xl bg-accent/30 -z-10" />
            <div className="h-24 w-24 md:h-28 md:w-28 rounded-full bg-[linear-gradient(135deg,hsl(var(--accent)),hsl(var(--primary)))] text-background font-display text-4xl uppercase flex items-center justify-center medieval-border">
              {user.displayName.charAt(0)}
            </div>
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-display tracking-wider uppercase bg-card medieval-border">
              Lv {level}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-display uppercase tracking-widest text-muted-foreground">
              Scheda del cavaliere
            </p>
            <h1 className="text-3xl font-display leading-tight">{user.displayName}</h1>
            <p className="gold-text text-sm font-display tracking-wide mt-0.5">{title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              @{user.username} · Dal {formatRelative(user.createdAt)}
            </p>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>XP</span>
                <span>
                  {xp} / {nextLevelXp}
                </span>
              </div>
              <Progress value={progressToNext} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Shield className="h-5 w-5" />} label="Gilde" value={groupsCount} />
        <StatCard icon={<Trophy className="h-5 w-5" />} label="Quest vinte" value={completed.length} />
        <StatCard icon={<Sparkles className="h-5 w-5" />} label="Milestone" value={unlockedMilestones} />
        <StatCard icon={<Crown className="h-5 w-5" />} label="Titolo" valueLabel={title} />
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-display flex items-center gap-2">
          <BookHeart className="h-5 w-5 text-accent" /> Quest conquistate
        </h2>
        {completed.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nessuna quest completata ancora. Il primo trofeo attende il tuo nome.
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {completed.map((g) => (
              <Link to={`/goals/${g.id}`} key={g.id}>
                <Card className="h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-11 w-11 rounded-md medieval-border bg-accent/20 text-accent flex items-center justify-center">
                      <GoalIconView name={g.icon} size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display truncate">{g.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Premio: {g.finalReward.title}
                      </p>
                    </div>
                    <AwardBadge unlocked size={28} />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" /> Quest in corso
        </h2>
        {inProgress.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nessuna quest aperta. Cerca una gilda o creane una tua.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {inProgress.map((g) => (
              <Link to={`/goals/${g.id}`} key={g.id}>
                <Card>
                  <CardContent className="p-3 flex items-center gap-3">
                    <GoalIconView name={g.icon} className="text-primary" size={24} />
                    <div className="flex-1 min-w-0">
                      <p className="font-display truncate">{g.title}</p>
                      <Progress value={g.points} size="sm" />
                    </div>
                    <Badge variant="gold">{g.points}</Badge>
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

function StatCard({
  icon,
  label,
  value,
  valueLabel,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  valueLabel?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <div className="h-10 w-10 rounded-full mx-auto flex items-center justify-center bg-muted/60 text-accent medieval-border">
          {icon}
        </div>
        <p className="text-xl font-display mt-2">{value ?? valueLabel}</p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
