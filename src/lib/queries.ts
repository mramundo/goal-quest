import type {
  Goal,
  GoalParticipantSummary,
  Group,
  ProgressEntry,
  User,
} from "@/types";
import {
  groupsOfUser,
  listGoals,
  listGroups,
  listProgress,
  listUsers,
  membersOfGroup,
  progressOfGoal,
} from "./db";
import { clamp } from "./utils";

/**
 * Aggregazioni read-only usate dalle pagine. Non toccano il DB in scrittura.
 */

export async function leaderboardForGoal(goal: Goal): Promise<GoalParticipantSummary[]> {
  const [users, progress] = await Promise.all([listUsers(), progressOfGoal(goal.id)]);
  const byUser = new Map<string, ProgressEntry[]>();
  for (const p of progress) {
    const list = byUser.get(p.userId) ?? [];
    list.push(p);
    byUser.set(p.userId, list);
  }

  const summaries: GoalParticipantSummary[] = [];
  for (const [userId, entries] of byUser) {
    const user = users.find((u) => u.id === userId);
    if (!user) continue;
    const points = clamp(entries.reduce((s, e) => s + e.points, 0), 0, 100);
    const lastActivityAt = entries[entries.length - 1]?.createdAt;
    const unlockedMilestones = goal.milestones.filter((m) => points >= m.points).map((m) => m.id);
    summaries.push({
      userId,
      username: user.username,
      displayName: user.displayName,
      points,
      lastActivityAt,
      unlockedMilestones,
      finalUnlocked: points >= 100,
    });
  }
  summaries.sort((a, b) => b.points - a.points || (a.lastActivityAt ?? "").localeCompare(b.lastActivityAt ?? ""));
  return summaries;
}

export async function userGroups(userId: string): Promise<Group[]> {
  const [groups, ids] = await Promise.all([listGroups(), groupsOfUser(userId)]);
  const set = new Set(ids);
  return groups.filter((g) => set.has(g.id));
}

export async function userGoals(userId: string): Promise<Goal[]> {
  const groups = await userGroups(userId);
  const groupIds = new Set(groups.map((g) => g.id));
  const goals = await listGoals();
  return goals.filter((g) => groupIds.has(g.groupId));
}

export async function groupMembers(groupId: string): Promise<User[]> {
  const [ids, users] = await Promise.all([membersOfGroup(groupId), listUsers()]);
  const set = new Set(ids);
  return users.filter((u) => set.has(u.id));
}

export async function userProgressOnGoal(
  goal: Goal,
  userId: string
): Promise<{ points: number; lastActivity?: string; entries: ProgressEntry[] }> {
  const entries = (await listProgress()).filter(
    (p) => p.goalId === goal.id && p.userId === userId
  );
  entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const points = clamp(
    entries.reduce((s, e) => s + e.points, 0),
    0,
    100
  );
  return { points, lastActivity: entries[entries.length - 1]?.createdAt, entries };
}

/**
 * Generatore di suggerimenti premio basato sul testo dell'obiettivo.
 * Euristica semplice: match parole chiave → set di premi "a tema".
 */
export function suggestRewards(goalText: string, milestone: boolean) {
  const t = goalText.toLowerCase();
  const pools: Array<{ match: RegExp; rewards: Array<{ title: string; description: string; icon: string }> }> = [
    {
      match: /palestr|fitness|allenament|corsa|km|run|esercizi|forza|peso/,
      rewards: [
        { title: "Cinta di ferro", description: "Una cena abbondante da guerriero.", icon: "sword" },
        { title: "Ampolla del vigore", description: "Un massaggio rilassante.", icon: "potion" },
        { title: "Medaglione d'acciaio", description: "Nuovo capo tecnico.", icon: "medal" },
      ],
    },
    {
      match: /libr|leggere|studio|studiare|corso|lezioni|imparare|codice|programmazione|lingua/,
      rewards: [
        { title: "Tomo proibito", description: "Un libro della tua wishlist.", icon: "scroll" },
        { title: "Pergamena dei saggi", description: "Un corso online.", icon: "scroll" },
        { title: "Chiave dell'archivio", description: "Abbonamento annuale a un tool pro.", icon: "key" },
      ],
    },
    {
      match: /risparm|soldi|investiment|budget|spese/,
      rewards: [
        { title: "Scrigno d'oro", description: "Un piccolo tesoro da spendere come vuoi.", icon: "chest" },
        { title: "Gemma del mercante", description: "Cena al ristorante preferito.", icon: "gem" },
      ],
    },
    {
      match: /dieta|mangiare|cibo|zucchero|salute/,
      rewards: [
        { title: "Pozione di rinnovamento", description: "Una spa o una giornata relax.", icon: "potion" },
        { title: "Corona di alloro", description: "Vestito nuovo alla taglia obiettivo.", icon: "crown" },
      ],
    },
    {
      match: /viagg|avventura|escursion|natura/,
      rewards: [
        { title: "Mappa del regno", description: "Week-end fuori porta.", icon: "map" },
        { title: "Ancora dell'esplorat.", description: "Equipaggiamento da trekking.", icon: "shield" },
      ],
    },
  ];

  const defaultPool = [
    { title: "Scrigno del viaggiatore", description: "Un regalo a sorpresa.", icon: "chest" },
    { title: "Medaglia di valore", description: "Una serata con gli amici.", icon: "medal" },
    { title: "Spada del condottiero", description: "Un acquisto desiderato.", icon: "sword" },
    { title: "Pergamena dorata", description: "Una giornata dedicata a te.", icon: "scroll" },
  ];

  const hits = pools.filter((p) => p.match.test(t)).flatMap((p) => p.rewards);
  const pool = hits.length ? hits : defaultPool;

  // Per milestone intermedie suggerisci premi "piccoli"; per il finale quelli "grandi"
  return milestone ? pool.slice(0, 4) : [...pool].reverse().slice(0, 4);
}

export function suggestActionPresets(goalText: string): Array<{ label: string; points: number }> {
  const t = goalText.toLowerCase();
  if (/palestr|fitness|allenament|forza|peso/.test(t))
    return [
      { label: "Sessione in palestra (60')", points: 5 },
      { label: "Allenamento a casa (30')", points: 3 },
      { label: "Camminata 10k passi", points: 2 },
    ];
  if (/corsa|run|km/.test(t))
    return [
      { label: "Corsa 5 km", points: 5 },
      { label: "Corsa 10 km", points: 10 },
      { label: "Ritmo sostenuto 3 km", points: 3 },
    ];
  if (/libr|leggere/.test(t))
    return [
      { label: "Letto 30 pagine", points: 4 },
      { label: "Finito un capitolo", points: 2 },
      { label: "Finito un libro", points: 15 },
    ];
  if (/studio|studiare|corso|lezioni|imparare/.test(t))
    return [
      { label: "Sessione di studio 1h", points: 5 },
      { label: "Lezione completata", points: 8 },
      { label: "Esercitazione svolta", points: 3 },
    ];
  if (/codice|programmazione|coding/.test(t))
    return [
      { label: "Pull Request mergiata", points: 6 },
      { label: "Bug risolto", points: 4 },
      { label: "Lezione/capitolo completato", points: 3 },
    ];
  if (/dieta|mangiare|zucchero/.test(t))
    return [
      { label: "Giornata rispettata", points: 3 },
      { label: "Settimana clean", points: 15 },
      { label: "Allenamento + dieta", points: 5 },
    ];
  if (/risparm|soldi|budget/.test(t))
    return [
      { label: "Risparmiati 50€", points: 5 },
      { label: "Spesa evitata", points: 2 },
      { label: "Mese in target", points: 20 },
    ];
  return [
    { label: "Piccolo passo", points: 2 },
    { label: "Progresso solido", points: 5 },
    { label: "Traguardo importante", points: 10 },
  ];
}
