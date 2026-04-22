import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Wand2,
  Save,
  Trophy,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  GoalIconView,
  GOAL_ICONS,
  REWARD_ICONS,
  RewardIconView,
} from "@/components/ui/MedievalIcon";
import type {
  ActionPreset,
  Goal,
  GoalIcon,
  Group,
  Milestone,
  Reward,
  RewardIcon,
} from "@/types";
import { createGoal, getGroup } from "@/lib/db";
import { suggestActionPresets, suggestRewards } from "@/lib/queries";
import { cn, uid } from "@/lib/utils";
import { useAuth } from "@/store/auth";

interface DraftMilestone {
  id: string;
  points: number;
  title: string;
  reward: Reward;
}

export function GoalCreatePage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<GoalIcon>("trophy");
  const [deadline, setDeadline] = useState("");
  const [milestones, setMilestones] = useState<DraftMilestone[]>([
    { id: uid("ms"), points: 25, title: "Primo passo deciso", reward: { title: "", description: "", icon: "potion" } },
    { id: uid("ms"), points: 50, title: "A metà della quest", reward: { title: "", description: "", icon: "medal" } },
    { id: uid("ms"), points: 75, title: "Traguardo in vista", reward: { title: "", description: "", icon: "gem" } },
  ]);
  const [finalReward, setFinalReward] = useState<Reward>({
    title: "Forziere leggendario",
    description: "",
    icon: "chest",
  });
  const [actions, setActions] = useState<ActionPreset[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    getGroup(groupId).then((g) => {
      if (!g) navigate("/groups", { replace: true });
      else setGroup(g);
    });
  }, [groupId, navigate]);

  // Aggiorna preset azioni quando cambia il testo dell'obiettivo
  useEffect(() => {
    if (!title && !description) return;
    const suggested = suggestActionPresets(title + " " + description);
    setActions(
      suggested.map((a) => ({ id: uid("act"), label: a.label, points: a.points }))
    );
  }, [title, description]);

  const sortedMilestones = useMemo(
    () => [...milestones].sort((a, b) => a.points - b.points),
    [milestones]
  );

  function addMilestone() {
    const lastPoints = sortedMilestones[sortedMilestones.length - 1]?.points ?? 0;
    const newPoints = Math.min(99, lastPoints + 15);
    setMilestones((m) => [
      ...m,
      {
        id: uid("ms"),
        points: newPoints,
        title: "Nuova tappa",
        reward: { title: "", description: "", icon: "medal" },
      },
    ]);
  }

  function updateMilestone(id: string, patch: Partial<DraftMilestone>) {
    setMilestones((m) => m.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function removeMilestone(id: string) {
    setMilestones((m) => m.filter((x) => x.id !== id));
  }

  function applyRewardSuggestion(target: "final" | string) {
    const base = `${title} ${description}`;
    const isFinal = target === "final";
    const suggestions = suggestRewards(base, !isFinal);
    const pick = suggestions[Math.floor(Math.random() * suggestions.length)];
    const reward: Reward = {
      title: pick.title,
      description: pick.description,
      icon: pick.icon as RewardIcon,
    };
    if (isFinal) setFinalReward(reward);
    else
      setMilestones((m) =>
        m.map((x) => (x.id === target ? { ...x, reward } : x))
      );
  }

  function updateAction(id: string, patch: Partial<ActionPreset>) {
    setActions((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function addAction() {
    setActions((a) => [...a, { id: uid("act"), label: "", points: 1 }]);
  }
  function removeAction(id: string) {
    setActions((a) => a.filter((x) => x.id !== id));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !group) return;

    // Validazione milestone
    const points = sortedMilestones.map((m) => m.points);
    if (points.some((p) => p < 1 || p > 99)) {
      toast.error("Le tappe devono essere tra 1 e 99 punti.");
      return;
    }
    if (new Set(points).size !== points.length) {
      toast.error("Le tappe devono avere punteggi diversi.");
      return;
    }
    if (!finalReward.title.trim()) {
      toast.error("Dai un nome al forziere finale.");
      return;
    }

    setBusy(true);
    try {
      const goal: Goal = {
        id: uid("gol"),
        groupId: group.id,
        title: title.trim(),
        description: description.trim(),
        icon,
        milestones: sortedMilestones.map<Milestone>((m) => ({
          id: m.id,
          points: m.points,
          title: m.title.trim() || `Tappa a ${m.points} punti`,
          reward: m.reward,
        })),
        finalReward,
        actionPresets: actions.filter((a) => a.label.trim() && a.points > 0),
        creatorId: user.id,
        createdAt: new Date().toISOString(),
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
      };
      await createGoal(goal);
      toast.success("Quest incisa nella pergamena!");
      navigate(`/goals/${goal.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Impossibile salvare la quest.");
    } finally {
      setBusy(false);
    }
  }

  if (!group || !user) return null;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={`/groups/${group.id}`}>
          <ArrowLeft className="h-4 w-4" /> Torna alla gilda
        </Link>
      </Button>

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Forgia una nuova quest</CardTitle>
            <CardDescription>
              Gilda <span className="font-display text-foreground">{group.name}</span> · Scolpisci
              l'obiettivo, spezzalo in tappe e promettiti dei premi degni.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="g-title">Titolo della quest</Label>
                <Input
                  id="g-title"
                  required
                  maxLength={80}
                  placeholder="es. Leggere 12 libri in un anno"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-deadline">Scadenza (opzionale)</Label>
                <Input
                  id="g-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-desc">Descrizione</Label>
              <Textarea
                id="g-desc"
                required
                maxLength={400}
                placeholder="Cosa significa esattamente? Qual è la regola del gioco?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Sigillo della quest</Label>
              <div className="grid grid-cols-8 gap-2">
                {GOAL_ICONS.map((ic) => (
                  <button
                    type="button"
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className={cn(
                      "aspect-square rounded-md medieval-border flex items-center justify-center",
                      icon === ic
                        ? "bg-accent/25 text-accent"
                        : "bg-muted/40 hover:bg-muted/60"
                    )}
                  >
                    <GoalIconView name={ic} size={20} />
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-accent" /> Tappe verso il forziere finale
            </CardTitle>
            <CardDescription>
              L'obiettivo finale vale sempre 100 punti. Ogni tappa sblocca un premio intermedio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MilestonePreview milestones={sortedMilestones} finalIcon={finalReward.icon} />

            <div className="space-y-3">
              {sortedMilestones.map((m, idx) => (
                <MilestoneEditor
                  key={m.id}
                  index={idx}
                  milestone={m}
                  onChange={(patch) => updateMilestone(m.id, patch)}
                  onRemove={() => removeMilestone(m.id)}
                  onSuggest={() => applyRewardSuggestion(m.id)}
                  canRemove={milestones.length > 1}
                />
              ))}

              <Button type="button" variant="outline" onClick={addMilestone}>
                <Plus className="h-4 w-4" /> Aggiungi tappa
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Final reward */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent" /> Forziere finale (100pt)
            </CardTitle>
            <CardDescription>
              Il premio riservato a chi porta la quest fino in fondo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RewardEditor
              reward={finalReward}
              onChange={setFinalReward}
              onSuggest={() => applyRewardSuggestion("final")}
            />
          </CardContent>
        </Card>

        {/* Action presets */}
        <Card>
          <CardHeader>
            <CardTitle>Azioni suggerite</CardTitle>
            <CardDescription>
              Preset cliccabili quando si logga un progresso. Suggerimenti basati sul testo
              dell'obiettivo; puoi modificarli.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {actions.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 rounded-md bg-muted/40 medieval-border p-2"
              >
                <Input
                  className="flex-1"
                  placeholder="es. Corsa 5 km"
                  value={a.label}
                  onChange={(e) => updateAction(a.id, { label: e.target.value })}
                />
                <Input
                  className="w-24"
                  type="number"
                  min={1}
                  max={100}
                  value={a.points}
                  onChange={(e) => updateAction(a.id, { points: Number(e.target.value) })}
                />
                <span className="text-xs text-muted-foreground">pt</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAction(a.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addAction}>
              <Plus className="h-4 w-4" /> Aggiungi azione
            </Button>
          </CardContent>
        </Card>

        <div className="flex gap-2 sticky bottom-20 md:bottom-4 bg-background/80 backdrop-blur-md p-2 rounded-md medieval-border">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={busy}>
            Annulla
          </Button>
          <Button type="submit" variant="gold" size="lg" className="flex-1" disabled={busy}>
            <Save className="h-4 w-4" />
            {busy ? "Incido la pergamena..." : "Crea la quest"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function MilestonePreview({
  milestones,
  finalIcon,
}: {
  milestones: DraftMilestone[];
  finalIcon: RewardIcon;
}) {
  return (
    <div className="relative h-14">
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-muted/50 medieval-border" />
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 h-2 rounded-full xp-fill pointer-events-none"
        style={{ width: "100%" }}
      />
      {milestones.map((m) => (
        <div
          key={m.id}
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${m.points}%` }}
          title={`${m.title} · ${m.points}pt`}
        >
          <div className="h-9 w-9 rounded-full bg-card medieval-border flex items-center justify-center text-accent">
            <RewardIconView name={m.reward.icon} size={16} />
          </div>
          <span className="absolute top-full mt-1 left-1/2 -translate-x-1/2 text-[10px] font-display tracking-wider">
            {m.points}
          </span>
        </div>
      ))}
      <div className="absolute top-1/2 left-full -translate-x-1/2 -translate-y-1/2">
        <div className="h-11 w-11 rounded-full bg-[linear-gradient(135deg,hsl(var(--accent)),hsl(var(--primary)))] medieval-border flex items-center justify-center text-background">
          <RewardIconView name={finalIcon} size={20} />
        </div>
        <span className="absolute top-full mt-1 left-1/2 -translate-x-1/2 text-[10px] font-display tracking-wider">
          100
        </span>
      </div>
    </div>
  );
}

function MilestoneEditor({
  index,
  milestone,
  onChange,
  onRemove,
  onSuggest,
  canRemove,
}: {
  index: number;
  milestone: DraftMilestone;
  onChange: (patch: Partial<DraftMilestone>) => void;
  onRemove: () => void;
  onSuggest: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-md medieval-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="gold">Tappa {index + 1}</Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onSuggest}>
            <Wand2 className="h-3.5 w-3.5" /> Suggerisci
          </Button>
          {canRemove && (
            <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr,100px] gap-3">
        <div className="space-y-1.5">
          <Label>Titolo della tappa</Label>
          <Input
            required
            value={milestone.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="es. Letti 3 libri"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Punti</Label>
          <Input
            required
            type="number"
            min={1}
            max={99}
            value={milestone.points}
            onChange={(e) => onChange({ points: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="pt-2 border-t border-border/60">
        <p className="text-[11px] font-display uppercase tracking-widest text-muted-foreground mb-2">
          Premio intermedio
        </p>
        <RewardEditor
          reward={milestone.reward}
          onChange={(reward) => onChange({ reward })}
          onSuggest={onSuggest}
          compact
        />
      </div>
    </div>
  );
}

function RewardEditor({
  reward,
  onChange,
  onSuggest,
  compact,
}: {
  reward: Reward;
  onChange: (r: Reward) => void;
  onSuggest: () => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className={cn("grid gap-3", compact ? "md:grid-cols-2" : "md:grid-cols-2")}>
        <div className="space-y-1.5">
          <Label>Nome del premio</Label>
          <Input
            required
            placeholder="es. Nuovo libro"
            value={reward.title}
            onChange={(e) => onChange({ ...reward, title: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Descrizione</Label>
          <Input
            placeholder="Dettagli o condizioni"
            value={reward.description}
            onChange={(e) => onChange({ ...reward, description: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Icona</Label>
          {!compact && (
            <Button type="button" size="sm" variant="ghost" onClick={onSuggest}>
              <Wand2 className="h-3.5 w-3.5" />
              Suggerisci premio
            </Button>
          )}
        </div>
        <div className="grid grid-cols-10 gap-2">
          {REWARD_ICONS.map((ic) => (
            <button
              type="button"
              key={ic}
              onClick={() => onChange({ ...reward, icon: ic })}
              className={cn(
                "aspect-square rounded-md medieval-border flex items-center justify-center",
                reward.icon === ic
                  ? "bg-accent/25 text-accent"
                  : "bg-card/50 hover:bg-muted/60"
              )}
              aria-label={ic}
            >
              <RewardIconView name={ic} size={18} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
