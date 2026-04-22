import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Crown, Plus, Target, Users as UsersIcon, Lock, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { GoalIconView, GroupIconView, AwardBadge } from "@/components/ui/MedievalIcon";
import type { Goal, Group, User } from "@/types";
import { getGroup, goalsOfGroup } from "@/lib/db";
import { groupMembers, leaderboardForGoal } from "@/lib/queries";
import { formatRelative } from "@/lib/utils";
import { useAuth } from "@/store/auth";

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [goals, setGoals] = useState<Array<Goal & { topPoints: number; participants: number }>>(
    []
  );
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    (async () => {
      setLoading(true);
      const g = await getGroup(groupId);
      if (!g) {
        navigate("/groups", { replace: true });
        return;
      }
      setGroup(g);
      const [gs, ms] = await Promise.all([goalsOfGroup(groupId), groupMembers(groupId)]);
      const enriched = await Promise.all(
        gs.map(async (goal) => {
          const leaderboard = await leaderboardForGoal(goal);
          return {
            ...goal,
            topPoints: leaderboard[0]?.points ?? 0,
            participants: leaderboard.length,
          };
        })
      );
      setGoals(enriched);
      setMembers(ms);
      setLoading(false);
    })();
  }, [groupId, navigate]);

  if (!group || !user) return null;
  const isOwner = group.ownerId === user.id;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/groups">
          <ArrowLeft className="h-4 w-4" /> Torna alle gilde
        </Link>
      </Button>

      <Card>
        <div className="p-5 md:p-7 flex flex-col md:flex-row md:items-center gap-4">
          <div className="h-16 w-16 rounded-lg medieval-border bg-muted/60 text-primary flex items-center justify-center shrink-0">
            <GroupIconView name={group.icon} size={32} />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl md:text-3xl font-display leading-tight">{group.name}</h1>
              {group.isPublic ? (
                <Badge variant="success">
                  <Globe2 className="h-3 w-3" /> Pubblica
                </Badge>
              ) : (
                <Badge variant="muted">
                  <Lock className="h-3 w-3" /> Privata
                </Badge>
              )}
              {isOwner && (
                <Badge variant="gold">
                  <Crown className="h-3 w-3" /> Fondatore
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{group.description}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <UsersIcon className="h-3.5 w-3.5" />
                {members.length} {members.length === 1 ? "membro" : "membri"}
              </span>
              <span className="flex items-center gap-1">
                <Target className="h-3.5 w-3.5" />
                {goals.length} {goals.length === 1 ? "quest" : "quest"}
              </span>
            </div>
          </div>

          <Button asChild variant="gold">
            <Link to={`/groups/${group.id}/goals/new`}>
              <Plus className="h-4 w-4" /> Nuova quest
            </Link>
          </Button>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-display flex items-center gap-2">
          <Target className="h-5 w-5 text-accent" /> Quest della gilda
        </h2>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-36 rounded-lg bg-muted/40 medieval-border animate-pulse" />
            ))}
          </div>
        ) : goals.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center space-y-3">
              <p className="font-display text-lg">Nessuna quest ancora scritta</p>
              <p className="text-sm text-muted-foreground">
                Scolpisci la prima tavola: crea un obiettivo e invita la gilda a raggiungerlo.
              </p>
              <Button asChild variant="gold">
                <Link to={`/groups/${group.id}/goals/new`}>
                  <Plus className="h-4 w-4" /> Crea la prima quest
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {goals.map((g) => (
              <Link key={g.id} to={`/goals/${g.id}`} className="group">
                <Card className="h-full transition-transform group-hover:-translate-y-0.5">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-11 w-11 rounded-md medieval-border bg-muted/60 text-primary flex items-center justify-center">
                        <GoalIconView name={g.icon} size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{g.title}</CardTitle>
                        <CardDescription className="line-clamp-1">
                          {g.description}
                        </CardDescription>
                      </div>
                      <AwardBadge unlocked={g.topPoints >= 100} size={32} />
                    </div>
                    <Progress value={g.topPoints} size="sm" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{g.milestones.length} tappe</span>
                      <span>
                        {g.participants}{" "}
                        {g.participants === 1 ? "avventuriero" : "avventurieri"}
                      </span>
                      {g.deadline && <span>entro {new Date(g.deadline).toLocaleDateString("it-IT")}</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-display flex items-center gap-2">
          <UsersIcon className="h-5 w-5 text-accent" /> Compagni di gilda
        </h2>
        {members.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nessun membro. Condividi il nome della gilda per reclutare.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {members.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-[linear-gradient(135deg,hsl(var(--accent)),hsl(var(--primary)))] text-background font-display text-xl flex items-center justify-center">
                    {m.displayName.charAt(0)}
                  </div>
                  <p className="text-sm font-display leading-tight">{m.displayName}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {m.title ?? "Avventuriero"}
                  </p>
                  {m.createdAt && (
                    <p className="text-[10px] text-muted-foreground">
                      Dal {formatRelative(m.createdAt)}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
