/* =========================================================
   Goal Quest — Supabase data layer
   Handles: anonymous auth, CRUD for profile/quests/quest_logs,
   and mapping between client (camelCase) and DB (snake_case).
   Tables and RLS are defined in the init_goal_quest_schema
   migration — every query runs as auth.uid() = current user.
   ========================================================= */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?bundle';

const SUPABASE_URL = 'https://ociyxmxlydeunoaendvp.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Xl1wSWVtpo7kWrKqTUMo7Q_Bd-FlZ_L';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage,
    storageKey: 'gq-auth',
  },
});

/* ---------- Auth ---------- */
/**
 * Returns a guaranteed session. If no session exists (first visit)
 * we fall back to anonymous sign-in — the anonymous user gets a
 * stable auth.uid() that RLS will bind all rows to.
 */
export async function ensureSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    // Most common case: the dashboard toggle for anonymous sign-ins is off.
    const hint = /anonymous.*disabled|not.*enabled/i.test(error.message ?? '')
      ? 'Enable "Anonymous sign-ins" in Supabase → Authentication → Providers.'
      : error.message;
    throw new Error(`Could not start a session. ${hint}`);
  }
  return data.session;
}

export function currentUserId() {
  return supabase.auth.getUser().then(r => r.data.user?.id ?? null);
}

/* ---------- Row mappers ---------- */
function questFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    icon: row.icon ?? '📜',
    topic: row.topic ?? 'general',
    milestones: Array.isArray(row.milestones) ? row.milestones : [],
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function questToRow(q, userId) {
  return {
    id: q.id,
    user_id: userId,
    title: q.title,
    description: q.description ?? '',
    icon: q.icon ?? '📜',
    topic: q.topic ?? 'general',
    milestones: q.milestones ?? [],
    created_at: q.createdAt ?? new Date().toISOString(),
    completed_at: q.completedAt ?? null,
  };
}

function logFromRow(row) {
  return {
    id: row.id,
    questId: row.quest_id,
    action: row.action,
    points: row.points,
    at: row.at,
  };
}

function logToRow(entry, userId) {
  return {
    id: entry.id,
    user_id: userId,
    quest_id: entry.questId,
    action: entry.action,
    points: entry.points,
    at: entry.at ?? new Date().toISOString(),
  };
}

function profileFromRow(row) {
  if (!row) return {};
  return {
    name: row.name,
    title: row.title ?? 'Traveler',
  };
}

/* ---------- Reads ---------- */
/** Loads profile + quests + logs in a single round-trip. */
export async function loadAll(userId) {
  const [profileRes, questsRes, logsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('quests').select('*').order('created_at', { ascending: false }),
    supabase.from('quest_logs').select('*').order('at', { ascending: false }),
  ]);

  if (profileRes.error) console.warn('[db] profile load:', profileRes.error.message);
  if (questsRes.error)  console.warn('[db] quests load:',  questsRes.error.message);
  if (logsRes.error)    console.warn('[db] logs load:',    logsRes.error.message);

  return {
    profile: profileFromRow(profileRes.data),
    quests: (questsRes.data ?? []).map(questFromRow),
    log: (logsRes.data ?? []).map(logFromRow),
  };
}

/* ---------- Writes ---------- */
export async function upsertProfile(userId, patch) {
  const row = {
    user_id: userId,
    name: patch.name,
    title: patch.title ?? 'Traveler',
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function insertQuest(userId, quest) {
  const row = questToRow(quest, userId);
  const { data, error } = await supabase.from('quests').insert(row).select().single();
  if (error) throw error;
  return questFromRow(data);
}

export async function patchQuest(id, patch) {
  const row = {};
  if ('title' in patch) row.title = patch.title;
  if ('description' in patch) row.description = patch.description;
  if ('icon' in patch) row.icon = patch.icon;
  if ('topic' in patch) row.topic = patch.topic;
  if ('milestones' in patch) row.milestones = patch.milestones;
  if ('completedAt' in patch) row.completed_at = patch.completedAt;
  const { error } = await supabase.from('quests').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteQuest(id) {
  // quest_logs cascade-delete via FK
  const { error } = await supabase.from('quests').delete().eq('id', id);
  if (error) throw error;
}

export async function insertLog(userId, entry) {
  const row = logToRow(entry, userId);
  const { data, error } = await supabase.from('quest_logs').insert(row).select().single();
  if (error) throw error;
  return logFromRow(data);
}

/* ---------- Initial seed (first-time user) ----------
   Loads the public seed file and creates matching DB rows so
   the user has examples to tinker with. Called only when the
   user has zero quests in the DB. */
export async function seedInitialQuests(userId, seedItems) {
  if (!Array.isArray(seedItems) || seedItems.length === 0) return [];
  const now = new Date().toISOString();
  const rows = seedItems.map(s => ({
    id: crypto.randomUUID(),
    user_id: userId,
    title: s.title,
    description: s.description ?? '',
    icon: s.icon ?? '📜',
    topic: s.topic ?? 'general',
    milestones: (s.milestones ?? []).map(m => ({
      id: crypto.randomUUID(),
      points: Math.max(1, Math.min(99, Number(m.points) || 0)),
      title: m.title ?? '',
      reward: m.reward ?? '',
    })),
    created_at: now,
    completed_at: null,
  }));
  const { data, error } = await supabase.from('quests').insert(rows).select();
  if (error) { console.warn('[db] seed insert failed:', error.message); return []; }
  return (data ?? []).map(questFromRow);
}
