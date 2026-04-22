import type {
  Goal,
  Group,
  Membership,
  ProgressEntry,
  User,
} from "@/types";
import { readJson, writeJson } from "./github-api";
import { config } from "./config";

/**
 * Strato di dominio sopra github-api.
 * Struttura dati: ogni file è un array di record.
 *
 * Cache: in-memory + localStorage come write-through; così:
 *   - le letture consecutive nella stessa sessione sono istantanee
 *   - in modalità demo (no token) riusiamo comunque i cambiamenti locali
 */

type Collection = "users" | "groups" | "memberships" | "goals" | "progress";

const FILENAMES: Record<Collection, string> = {
  users: "users.json",
  groups: "groups.json",
  memberships: "memberships.json",
  goals: "goals.json",
  progress: "progress.json",
};

const LS_PREFIX = "goalquest:db:";

const memCache = new Map<Collection, unknown>();

async function loadCollection<T>(col: Collection): Promise<T[]> {
  if (memCache.has(col)) return memCache.get(col) as T[];

  // In demo mode preferisci localStorage se presente
  if (config.demoMode) {
    const cached = localStorage.getItem(LS_PREFIX + col);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as T[];
        memCache.set(col, parsed);
        return parsed;
      } catch {
        /* ignore */
      }
    }
  }

  const data = await readJson<T[]>(FILENAMES[col], []);
  memCache.set(col, data);
  if (config.demoMode) {
    localStorage.setItem(LS_PREFIX + col, JSON.stringify(data));
  }
  return data;
}

async function saveCollection<T>(
  col: Collection,
  data: T[],
  message: string
): Promise<void> {
  memCache.set(col, data);
  localStorage.setItem(LS_PREFIX + col, JSON.stringify(data));
  if (!config.demoMode) {
    await writeJson(FILENAMES[col], data, message);
  }
}

function invalidate(col: Collection) {
  memCache.delete(col);
}

// ---------- Users ----------

export async function listUsers(): Promise<User[]> {
  return loadCollection<User>("users");
}

export async function findUserByUsername(username: string): Promise<User | undefined> {
  const users = await listUsers();
  return users.find((u) => u.username.toLowerCase() === username.toLowerCase());
}

export async function upsertUser(user: User, message: string): Promise<void> {
  const users = await listUsers();
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx >= 0) users[idx] = user;
  else users.push(user);
  await saveCollection("users", users, message);
}

// ---------- Groups ----------

export async function listGroups(): Promise<Group[]> {
  return loadCollection<Group>("groups");
}

export async function createGroup(group: Group): Promise<void> {
  const groups = await listGroups();
  groups.push(group);
  await saveCollection("groups", groups, `chore(groups): new group ${group.name}`);
}

export async function getGroup(id: string): Promise<Group | undefined> {
  const groups = await listGroups();
  return groups.find((g) => g.id === id);
}

// ---------- Memberships ----------

export async function listMemberships(): Promise<Membership[]> {
  return loadCollection<Membership>("memberships");
}

export async function addMembership(m: Membership): Promise<void> {
  const rows = await listMemberships();
  if (rows.some((r) => r.userId === m.userId && r.groupId === m.groupId)) return;
  rows.push(m);
  await saveCollection("memberships", rows, `chore(memberships): ${m.userId} -> ${m.groupId}`);
}

export async function membersOfGroup(groupId: string): Promise<string[]> {
  const rows = await listMemberships();
  return rows.filter((r) => r.groupId === groupId).map((r) => r.userId);
}

export async function groupsOfUser(userId: string): Promise<string[]> {
  const rows = await listMemberships();
  return rows.filter((r) => r.userId === userId).map((r) => r.groupId);
}

// ---------- Goals ----------

export async function listGoals(): Promise<Goal[]> {
  return loadCollection<Goal>("goals");
}

export async function goalsOfGroup(groupId: string): Promise<Goal[]> {
  const goals = await listGoals();
  return goals.filter((g) => g.groupId === groupId);
}

export async function getGoal(id: string): Promise<Goal | undefined> {
  const goals = await listGoals();
  return goals.find((g) => g.id === id);
}

export async function createGoal(goal: Goal): Promise<void> {
  const goals = await listGoals();
  goals.push(goal);
  await saveCollection("goals", goals, `chore(goals): new goal ${goal.title}`);
}

// ---------- Progress ----------

export async function listProgress(): Promise<ProgressEntry[]> {
  return loadCollection<ProgressEntry>("progress");
}

export async function progressOfGoal(goalId: string): Promise<ProgressEntry[]> {
  const rows = await listProgress();
  return rows
    .filter((p) => p.goalId === goalId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function logProgress(entry: ProgressEntry): Promise<void> {
  const rows = await listProgress();
  rows.push(entry);
  await saveCollection("progress", rows, `feat(progress): +${entry.points}pt ${entry.userId}`);
}

export function refresh() {
  (["users", "groups", "memberships", "goals", "progress"] as Collection[]).forEach(invalidate);
}
