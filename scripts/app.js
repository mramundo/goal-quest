/* =========================================================
   Goal Quest — App entry point
   Wires up: theme, Supabase session, reactive store, seed data,
   hero recap, footer meta. Delegates rendering to the three
   feature modules (quests, hall, chronicle). All user data lives
   in Supabase — localStorage only stores palette/mode preferences
   and the auth session (handled by the supabase-js client).
   ========================================================= */

import { initQuests, openQuestComposer, refreshQuests, closeComposer } from './quests.js?v=20260425a';
import { initProgress, refreshChronicle, flashToast } from './progress.js?v=20260425a';
import { initHall, refreshHall } from './hall.js?v=20260425a';
import {
  getSession, onAuthStateChange,
  signUpEmailPassword, signInEmailPassword, signOut as supabaseSignOut,
  loadAll, upsertProfile,
  insertQuest, patchQuest, deleteQuest,
  insertLog, seedInitialQuests,
  fetchHallOfFame, fetchRealmStats,
} from './db.js?v=20260425a';

/* ---------- DOM helpers ---------- */
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Constants ---------- */
const CONFIG = {
  // Quests seed runs once when a brand-new user has zero rows in the DB.
  // `actions-library.json` powers the action picker and is purely static.
  // The Hall of Fame + realm stats now come straight from Supabase RPCs.
  seedQuests: 'data/quests.seed.json',
  actionsLib: 'data/actions-library.json',
};

const LOCALE = 'en-US';

// Theme prefs only — user data + auth session live in Supabase.
// (supabase-js stores its own session under `gq-auth` in localStorage.)
const STORAGE = {
  palette: 'gq-palette',
  mode:    'gq-mode',
};

const PALETTES = ['parchment', 'tavern', 'elven-forest', 'frozen-realm'];
const MODES    = ['dark', 'light'];

/* ---------- Reactive store ---------- */
function createStore(initial = {}) {
  const listeners = new Set();
  const state = { ...initial };
  const notify = (key, val) => {
    listeners.forEach(fn => {
      try { fn(key, val, state); }
      catch (err) { console.error('[store] listener error:', err); }
    });
  };
  return {
    get: (key) => state[key],
    getAll: () => ({ ...state }),
    set(key, val) {
      state[key] = val;
      notify(key, val);
    },
    patch(partial) {
      Object.assign(state, partial);
      notify(null, null);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/* ---------- Theme (palette + mode) ---------- */
function initTheme() {
  const root = document.documentElement;

  let storedPalette = localStorage.getItem(STORAGE.palette);
  if (!PALETTES.includes(storedPalette)) storedPalette = 'parchment';

  let storedMode = localStorage.getItem(STORAGE.mode);
  if (!MODES.includes(storedMode)) {
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    storedMode = prefersLight ? 'light' : 'dark';
  }

  applyTheme(storedPalette, storedMode);

  $('#themeToggle')?.addEventListener('click', () => {
    const next = root.dataset.mode === 'light' ? 'dark' : 'light';
    applyTheme(root.dataset.palette, next);
    localStorage.setItem(STORAGE.mode, next);
  });

  const toggle = $('#paletteToggle');
  const menu   = $('#paletteMenu');
  if (toggle && menu) {
    const options = [...menu.querySelectorAll('.palette-picker__option')];

    const markCurrent = (palette) => {
      options.forEach(o => o.setAttribute('aria-current',
        o.dataset.palette === palette ? 'true' : 'false'));
    };
    markCurrent(storedPalette);

    const closeMenu = () => { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };
    const openMenu  = () => { menu.hidden = false; toggle.setAttribute('aria-expanded', 'true'); };

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.hidden ? openMenu() : closeMenu();
    });

    options.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const palette = opt.dataset.palette;
        if (!PALETTES.includes(palette)) return;
        applyTheme(palette, root.dataset.mode);
        localStorage.setItem(STORAGE.palette, palette);
        markCurrent(palette);
        closeMenu();
      });
    });

    document.addEventListener('click', (e) => {
      if (!menu.hidden && !menu.contains(e.target) && e.target !== toggle) closeMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) closeMenu();
    });
  }
}

function applyTheme(palette, mode) {
  const root = document.documentElement;
  root.dataset.palette = palette;
  root.dataset.mode = mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim() || '#1a1410';
    meta.setAttribute('content', bg);
  }
}

/* ---------- Fetch JSON (read-only seeds) ---------- */
async function fetchJSON(url) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[data] fetch failed for ${url}:`, err.message);
    return null;
  }
}

/* ---------- Formatting utils ---------- */
export const fmt = {
  date(iso) {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat(LOCALE, {
        day: '2-digit', month: 'short', year: 'numeric',
      }).format(new Date(iso));
    } catch { return '—'; }
  },
  dateTime(iso) {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat(LOCALE, {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }).format(new Date(iso));
    } catch { return '—'; }
  },
  relative(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.round(diffMs / 60000);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    if (Math.abs(diffMin) < 1) return 'just now';
    if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, 'minute');
    const diffH = Math.round(diffMin / 60);
    if (Math.abs(diffH) < 24) return rtf.format(-diffH, 'hour');
    const diffD = Math.round(diffH / 24);
    if (Math.abs(diffD) < 7)  return rtf.format(-diffD, 'day');
    const diffW = Math.round(diffD / 7);
    if (Math.abs(diffW) < 5)  return rtf.format(-diffW, 'week');
    return new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  },
  number(n) {
    return new Intl.NumberFormat(LOCALE).format(Math.round(Number(n) || 0));
  },
};

/**
 * Every persisted id needs to be a real UUID because the DB columns
 * are uuid-typed. The `prefix` argument is kept for call-site
 * readability but ignored.
 */
export function uid(_prefix = 'id') {
  return (crypto.randomUUID && crypto.randomUUID()) ||
         `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
export function escapeAttr(s) { return escapeHtml(s).replace(/\s+/g, ' '); }

export function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

/* ---------- Quest + log computations ---------- */
export function computeMetrics(quests, log) {
  const totalXp = log.reduce((s, l) => s + (Number(l.points) || 0), 0);
  const activeQuests = quests.filter(q => !q.completedAt).length;

  let milestonesUnlocked = 0;
  let milestonesTotal = 0;
  for (const q of quests) {
    const progress = progressFor(q, log);
    for (const m of (q.milestones ?? [])) {
      milestonesTotal += 1;
      if (progress >= m.points) milestonesUnlocked += 1;
    }
  }
  return { totalXp, activeQuests, milestonesUnlocked, milestonesTotal };
}

/** Quest progress = sum of logged points (capped at 100). */
export function progressFor(quest, log) {
  const sum = log
    .filter(l => l.questId === quest.id)
    .reduce((s, l) => s + (Number(l.points) || 0), 0);
  return clamp(Math.round(sum), 0, 100);
}

/* ---------- Hero recap numbers ---------- */
function animateNumber(el, target) {
  if (!el || !Number.isFinite(target)) return;
  // If the tab is in the background the RAF queue is throttled and the
  // step loop can sit for seconds — which would leave the placeholder
  // '—' on screen. Write the final value first so the number is always
  // correct, then run the easing animation on top when we're visible.
  const finalText = Math.round(target).toLocaleString(LOCALE);
  el.textContent = finalText;
  if (document.hidden) return;

  const duration = 700;
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(target * eased).toLocaleString(LOCALE);
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = finalText;
  }
  requestAnimationFrame(step);
}

function renderHeroRecap(store) {
  const quests = store.get('quests') ?? [];
  const log    = store.get('log') ?? [];
  const profile = store.get('profile') ?? {};
  const session = store.get('session');
  const realmStats = store.get('realmStats');
  const m = computeMetrics(quests, log);

  // Signed-out visitors see realm-wide totals aggregated by the
  // `realm_stats` SECURITY DEFINER function so the three hero cards
  // reflect actual DB state. Signed-in users see their personal numbers.
  const realm = realmStats
    ? {
        activeQuests: realmStats.activeQuests,
        totalXp: realmStats.totalXp,
        chests: realmStats.chestsOpened,
      }
    : { activeQuests: 0, totalXp: 0, chests: 0 };

  const display = session
    ? { activeQuests: m.activeQuests, totalXp: m.totalXp, chests: m.milestonesUnlocked }
    : realm;

  animateNumber($('#heroQuests'), display.activeQuests);
  animateNumber($('#heroXp'), display.totalXp);
  animateNumber($('#heroMilestones'), display.chests);

  // Stat-card labels — swap copy when signed-out so the realm-wide
  // numbers don't read as "your" stats. Signed-in copy is the personal
  // version that ships in the static HTML.
  const labels = session
    ? { quests: 'Active quests', xp: 'Total XP', chests: 'Chests opened' }
    : { quests: 'Quests in the realm', xp: 'XP earned by heroes', chests: 'Chests opened in the realm' };
  const qLab = $('#heroQuestsLabel');     if (qLab) qLab.textContent = labels.quests;
  const xLab = $('#heroXpLabel');         if (xLab) xLab.textContent = labels.xp;
  const cLab = $('#heroMilestonesLabel'); if (cLab) cLab.textContent = labels.chests;

  // Chip only renders when signed in — hidden by CSS otherwise.
  const chipLabel = $('#heroChipLabel');
  if (chipLabel) {
    chipLabel.textContent = session ? (profile.name || session.heroName || 'Hero') : '—';
  }

  const greet = $('#heroGreeting');
  if (greet) {
    const hour = new Date().getHours();
    const base = hour < 6 ? 'The stars keep watch'
               : hour < 12 ? 'Good morning'
               : hour < 18 ? 'The sun lights your road'
               : 'The torches are lit';
    // Signed-out users get a generic honorific so the chip stays inviting
    // without pretending to know who they are.
    const name = session ? (profile.name || session.heroName || '') : 'adventurer';
    const tail = name ? `, ${name}` : '';
    if (!session) {
      greet.textContent = `${base}${tail} — sign in to open your chronicle`;
    } else if (m.activeQuests > 0) {
      greet.textContent = `${base}${tail} — ${m.activeQuests} ${m.activeQuests === 1 ? 'quest awaits' : 'quests await'}`;
    } else {
      greet.textContent = `${base}${tail} — your chronicle is ready`;
    }
  }
}

/* ---------- Footer meta ---------- */
function setMeta() {
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
}

/* ---------- Store mutations ----------
   Pattern: optimistic in-memory update first (UI responds instantly),
   then fire the DB write. On failure we surface a toast and log the
   error — the user can refresh to re-hydrate from the source of truth. */

// Module-scoped user id — set whenever a Supabase session lands
// (boot, sign-in, auth-state-change) and cleared on sign-out.
let currentUid = null;

function surfaceDbError(prefix, err) {
  console.error(`[db] ${prefix}:`, err);
  flashToast({
    kind: 'error',
    title: 'Sync failed',
    desc: err?.message ?? 'Your change may not have been saved. Refresh to retry.',
  });
}

export function addQuest(store, quest) {
  const list = [quest, ...(store.get('quests') ?? [])];
  store.set('quests', list);
  if (!currentUid) return;
  insertQuest(currentUid, quest)
    .then(() => refreshPublicAggregates(store))
    .catch(err => surfaceDbError('addQuest', err));
}

export function updateQuest(store, id, patch) {
  const list = (store.get('quests') ?? []).map(q => q.id === id ? { ...q, ...patch } : q);
  store.set('quests', list);
  if (!currentUid) return;
  patchQuest(id, patch)
    .then(() => refreshPublicAggregates(store))
    .catch(err => surfaceDbError('updateQuest', err));
}

export function removeQuest(store, id) {
  const list = (store.get('quests') ?? []).filter(q => q.id !== id);
  store.set('quests', list);

  // DB cascades logs, but we need to drop them from the local store too.
  const log = (store.get('log') ?? []).filter(l => l.questId !== id);
  store.set('log', log);

  if (!currentUid) return;
  deleteQuest(id)
    .then(() => refreshPublicAggregates(store))
    .catch(err => surfaceDbError('removeQuest', err));
}

export function appendLog(store, entry) {
  const list = [entry, ...(store.get('log') ?? [])];
  store.set('log', list);
  if (!currentUid) return;
  insertLog(currentUid, entry)
    .then(() => refreshPublicAggregates(store))
    .catch(err => surfaceDbError('appendLog', err));
}

export function updateProfile(store, patch) {
  const profile = { ...(store.get('profile') ?? {}), ...patch };
  store.set('profile', profile);
  if (!currentUid) return;
  upsertProfile(currentUid, profile)
    .then(() => refreshPublicAggregates(store))
    .catch(err => surfaceDbError('updateProfile', err));
}

export function exportEverything(store) {
  return {
    schema: 2,
    exportedAt: new Date().toISOString(),
    quests: store.get('quests') ?? [],
    log: store.get('log') ?? [],
    profile: store.get('profile') ?? {},
  };
}

/* ---------- Auth state ----------
   The store's `session` key mirrors the Supabase session; we shape
   it down to `{ email, heroName, userId }` so the rest of the UI
   doesn't need to know about Supabase internals. */

function shapeSession(supaSession, heroName) {
  if (!supaSession?.user) return null;
  return {
    userId: supaSession.user.id,
    email: supaSession.user.email,
    heroName: heroName || supaSession.user.user_metadata?.hero_name || null,
  };
}

function applyAuthState(store) {
  const session = store.get('session');
  document.documentElement.dataset.auth = session ? 'signed-in' : 'signed-out';
}

/** Hydrate the store from Supabase for a given userId, then start a
 *  first-time seed if the user has zero quests. */
async function hydrateForUser(store, userId) {
  const userData = await loadAll(userId);
  store.patch({
    quests: userData.quests,
    log: userData.log,
    profile: userData.profile ?? {},
  });
  await seedIfEmpty(store);
}

/** Re-pull the public Hall of Fame + realm stats. Fire-and-forget after
 *  any mutation that could shift them; failures fall back to whatever's
 *  already in the store. */
function refreshPublicAggregates(store) {
  Promise.all([fetchHallOfFame(25), fetchRealmStats()]).then(([heroes, realmStats]) => {
    store.set('heroes', Array.isArray(heroes) ? heroes : []);
    store.set('realmStats', realmStats);
  }).catch(err => console.warn('[db] refreshPublicAggregates:', err));
}

/* ---------- Password rules + show/hide toggle ---------- */
/**
 * Modern password checklist — every rule must pass before signup
 * submission is allowed. Keep labels in sync with the `data-rule`
 * markers in the signup form's `data-pw-reqs` list.
 */
const PASSWORD_RULES = [
  { key: 'length', test: (pw) => pw.length >= 8 },
  { key: 'upper',  test: (pw) => /[A-Z]/.test(pw) },
  { key: 'lower',  test: (pw) => /[a-z]/.test(pw) },
  { key: 'digit',  test: (pw) => /\d/.test(pw) },
  { key: 'symbol', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

function checkPasswordRules(pw) {
  return Object.fromEntries(PASSWORD_RULES.map(r => [r.key, r.test(pw)]));
}

/** All rules pass → signup password is strong enough. */
function isPasswordStrong(pw) {
  return PASSWORD_RULES.every(r => r.test(pw));
}

function renderPasswordReqs(listEl, pw) {
  if (!listEl) return;
  const results = checkPasswordRules(pw);
  listEl.querySelectorAll('[data-rule]').forEach(li => {
    li.classList.toggle('is-valid', !!results[li.dataset.rule]);
  });
}

/** Toggle show/hide on any input paired with [data-password-toggle]. */
function initPasswordToggles(scope = document) {
  scope.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-password-toggle]');
    if (!btn) return;
    const input = btn.closest('.field__password-wrap')?.querySelector('input');
    if (!input) return;
    const next = input.type === 'password' ? 'text' : 'password';
    input.type = next;
    const pressed = next === 'text';
    btn.setAttribute('aria-pressed', String(pressed));
    btn.setAttribute('aria-label', pressed ? 'Hide password' : 'Show password');
  });
}

/* ---------- Auth dialog (sign in / sign up) ---------- */
function openAuthDialog(tab = 'signin') {
  const dlg = $('#authDialog');
  if (!dlg) return;
  dlg.hidden = false;
  switchAuthTab(tab);
  // Clear prior errors + focus the first input for fast typing
  $$('#authDialog [data-auth-error]').forEach(el => { el.hidden = true; el.textContent = ''; });
  requestAnimationFrame(() => {
    const panel = dlg.querySelector(`[data-auth-panel="${tab}"]`);
    panel?.querySelector('input')?.focus();
  });
}
function closeAuthDialog() {
  const dlg = $('#authDialog');
  if (!dlg) return;
  dlg.hidden = true;
}
function switchAuthTab(tab) {
  const dlg = $('#authDialog');
  if (!dlg) return;
  dlg.querySelectorAll('[data-auth-tab]').forEach(btn => {
    const active = btn.dataset.authTab === tab;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  dlg.querySelectorAll('[data-auth-panel]').forEach(panel => {
    panel.hidden = panel.dataset.authPanel !== tab;
  });
}

/** Friendlier copy for the most common Supabase auth error strings. */
function authErrorMessage(err) {
  const raw = (err?.message || '').toLowerCase();
  if (raw.includes('invalid login')) return "That email and password don't match any chronicle yet.";
  if (raw.includes('email not confirmed')) return 'Confirm your email first — check your inbox for the link.';
  if (raw.includes('user already registered')) return 'An account already exists for that email. Try signing in instead.';
  if (raw.includes('rate limit')) return 'Too many tries. Wait a moment, then try again.';
  return err?.message || "Can't reach the realm right now. Try again in a moment.";
}

async function signInWithEmailPassword(store, { email, password }) {
  let user, session;
  try {
    ({ user, session } = await signInEmailPassword({ email, password }));
  } catch (err) {
    return { ok: false, error: authErrorMessage(err) };
  }
  if (!user || !session) {
    return { ok: false, error: 'Sign-in did not return a session. Try again.' };
  }

  currentUid = user.id;
  try {
    await hydrateForUser(store, currentUid);
  } catch (err) {
    console.warn('[auth] hydrate failed:', err);
  }
  const profile = store.get('profile') ?? {};
  store.set('session', shapeSession(session, profile.name));
  applyAuthState(store);
  refreshPublicAggregates(store);

  return { ok: true, heroName: profile.name || user.user_metadata?.hero_name || 'Hero' };
}

async function signUpWithEmailPassword(store, { email, password, heroName }) {
  let user, session;
  try {
    ({ user, session } = await signUpEmailPassword({ email, password, heroName }));
  } catch (err) {
    return { ok: false, error: authErrorMessage(err) };
  }

  // Email-confirmation flow → no session yet, user must click the link.
  if (!session) {
    return { ok: true, needsConfirm: true, heroName };
  }

  currentUid = user.id;
  // The DB trigger seeds profiles.name from raw_user_meta_data.hero_name,
  // but it can race the first read on slow connections — patch defensively.
  try {
    await hydrateForUser(store, currentUid);
    const profile = store.get('profile') ?? {};
    if (!profile.name && heroName) {
      updateProfile(store, { name: heroName });
    }
  } catch (err) {
    console.warn('[auth] hydrate failed:', err);
  }
  const profile = store.get('profile') ?? {};
  store.set('session', shapeSession(session, profile.name || heroName));
  applyAuthState(store);
  refreshPublicAggregates(store);

  return { ok: true, needsConfirm: false, heroName: profile.name || heroName };
}

async function signOut(store) {
  try {
    await supabaseSignOut();
  } catch (err) {
    console.warn('[auth] sign-out failed:', err);
  }
  currentUid = null;
  store.patch({ quests: [], log: [], profile: {}, session: null });
  applyAuthState(store);
  refreshPublicAggregates(store);
  flashToast({
    kind: 'success',
    title: 'Signed out',
    desc: 'Your chronicle is safely stored. Sign back in any time.',
  });
}

function initAuthDialog(store) {
  const dlg = $('#authDialog');
  if (!dlg) return;

  // Password show/hide buttons (spectacles) — scoped to the dialog so we
  // don't catch unrelated password fields elsewhere.
  initPasswordToggles(dlg);

  // Openers scattered across the page (hero CTA, topbar pill, empty state…)
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-auth-open]');
    if (opener) {
      e.preventDefault();
      const tab = opener.dataset.authTab || 'signin';
      openAuthDialog(tab);
      return;
    }
    if (e.target.closest('[data-auth-close]')) {
      e.preventDefault();
      closeAuthDialog();
    }
  });

  // Tab switch
  dlg.querySelectorAll('[data-auth-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.authTab));
  });

  // Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dlg.hidden) closeAuthDialog();
  });

  // Sign-in submit
  const signinForm = dlg.querySelector('[data-auth-panel="signin"]');
  signinForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = signinForm.elements.email.value.trim();
    const password = signinForm.elements.password.value;
    const err = signinForm.querySelector('[data-auth-error]');
    if (err) { err.hidden = true; err.textContent = ''; }

    const submitBtn = signinForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const result = await signInWithEmailPassword(store, { email, password });

    if (submitBtn) submitBtn.disabled = false;

    if (!result.ok) {
      if (err) { err.hidden = false; err.textContent = result.error; }
      return;
    }
    signinForm.reset();
    closeAuthDialog();
    flashToast({
      kind: 'success',
      title: `Welcome back, ${result.heroName}`,
      desc: 'Your chronicle is open. Forge a new quest, or pick up where you left off.',
    });
  });

  // Sign-up submit — creates a real Supabase user. The DB trigger
  // `on_auth_user_created` seeds the profiles row from
  // raw_user_meta_data.hero_name; we just need to mirror it client-side.
  const signupForm = dlg.querySelector('[data-auth-panel="signup"]');
  if (signupForm) {
    const reqsList = signupForm.querySelector('[data-pw-reqs]');
    const pwInput = signupForm.elements.password;
    // Live checklist — each keystroke flips matching <li>.is-valid.
    pwInput?.addEventListener('input', () => {
      renderPasswordReqs(reqsList, pwInput.value);
    });
    renderPasswordReqs(reqsList, pwInput?.value || '');

    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = signupForm.querySelector('[data-auth-error]');
      if (err) { err.hidden = true; err.textContent = ''; }

      const email    = signupForm.elements.email.value.trim();
      const password = signupForm.elements.password.value;
      const confirm  = signupForm.elements.passwordConfirm.value;
      const heroName = signupForm.elements.heroName.value.trim().slice(0, 32);

      const showErr = (msg) => {
        if (!err) return;
        err.hidden = false;
        err.textContent = msg;
      };

      if (!email || !heroName) {
        showErr('Fill in every field to forge your chronicle.');
        return;
      }
      if (!isPasswordStrong(password)) {
        showErr('Your password must meet every requirement above.');
        return;
      }
      if (password !== confirm) {
        showErr('The two passwords don\u2019t match. Try again.');
        return;
      }

      const submitBtn = signupForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const result = await signUpWithEmailPassword(store, { email, password, heroName });

      if (submitBtn) submitBtn.disabled = false;

      if (!result.ok) {
        showErr(result.error);
        return;
      }

      signupForm.reset();
      renderPasswordReqs(reqsList, '');

      if (result.needsConfirm) {
        // Project has email-confirmation enabled — push them to signin
        // and tell them to check their inbox.
        switchAuthTab('signin');
        flashToast({
          kind: 'info',
          title: 'Almost there',
          desc: `We sent a confirmation link to ${email}. Click it, then sign in.`,
        });
        return;
      }

      // Auto-confirm enabled → already signed in. Close dialog + welcome.
      closeAuthDialog();
      flashToast({
        kind: 'success',
        title: `Welcome, ${result.heroName}`,
        desc: 'Your chronicle is forged. Forge your first quest to begin.',
      });
    });
  }
}

function initSignOut(store) {
  $('#signOutBtn')?.addEventListener('click', () => signOut(store));
}

function initEditHero(store) {
  $('#editProfileBtn')?.addEventListener('click', () => {
    if (!store.get('session')) return;
    const profile = store.get('profile') ?? {};
    const current = profile.name || '';
    const next = prompt('What name shall history remember?', current);
    if (next == null) return;
    const trimmed = next.trim().slice(0, 32);
    if (!trimmed || trimmed === current) return;
    updateProfile(store, { name: trimmed });
    flashToast({ kind: 'success', title: 'Hero renamed', desc: `Now known as ${trimmed}.` });
  });
}

/* ---------- Seed initial data ---------- */
async function seedIfEmpty(store) {
  if (!currentUid) return;
  const quests = store.get('quests') ?? [];
  if (quests.length > 0) return;

  const seeds = await fetchJSON(CONFIG.seedQuests);
  if (!Array.isArray(seeds?.items)) return;

  const inserted = await seedInitialQuests(currentUid, seeds.items);
  if (inserted.length) store.set('quests', inserted);
}

/* ---------- Fatal boot error helper ---------- */
function showBootError(message) {
  flashToast({
    kind: 'error',
    title: "Can't reach the realm",
    desc: message || 'Authentication error. Refresh after checking your connection.',
  });
}

/* ---------- Dragon engraving (Opzione A) ----------
   For each element with `data-engraving-src` pointing at a base64 JPEG
   text file, build an SVG in-memory whose <mask> converts the greyscale
   raster into an ink channel (per-channel inversion so the default
   luminance mask reveals the dark strokes). A rect filled with
   `currentColor` is clipped by that mask — the ink then follows the
   host's CSS `color`, so swapping the palette recolors the engraving.

   Why not ship a static .svg with <image href="asset.jpg">? Two reasons:
   1. <img src="file.svg"> sandboxes the SVG document, blocking the
      external JPEG fetch and severing `currentColor` inheritance.
   2. Inlining the static SVG via innerHTML works, but any middleware
      that rewrites relative hrefs breaks it. A data: URL built from a
      base64 blob avoids all of that. */
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

async function buildEngravings() {
  const hosts = document.querySelectorAll('[data-engraving-src]');
  await Promise.all([...hosts].map(async (host) => {
    const src = host.getAttribute('data-engraving-src');
    if (!src) return;
    try {
      const res = await fetch(src, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`${res.status}`);
      const b64 = (await res.text()).trim();
      const dataUrl = 'data:image/jpeg;base64,' + b64;
      const viewW = Number(host.getAttribute('data-engraving-w')) || 820;
      const viewH = Number(host.getAttribute('data-engraving-h')) || 1200;
      host.replaceChildren(buildEngravingSvg(dataUrl, viewW, viewH));
      host.removeAttribute('data-engraving-src');
    } catch (err) {
      console.warn(`[engraving] failed to load ${src}:`, err.message);
    }
  }));
}

function buildEngravingSvg(dataUrl, W, H) {
  const uid = `gq-ink-${Math.random().toString(36).slice(2, 8)}`;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label',
    'Saint George and the dragon — after Albrecht Dürer (c. 1505)');

  const defs = document.createElementNS(SVG_NS, 'defs');

  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', `${uid}-filter`);
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', '100%');
  filter.setAttribute('height', '100%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  const cm = document.createElementNS(SVG_NS, 'feColorMatrix');
  cm.setAttribute('type', 'matrix');
  // Per-channel inversion: paper (R=G=B≈1) → 0, ink (R=G=B≈0) → 1.
  // Output stays greyscale so a default luminance mask picks it up.
  cm.setAttribute(
    'values',
    '-1.35 0 0 0 1.30  0 -1.35 0 0 1.30  0 0 -1.35 0 1.30  0 0 0 0 1'
  );
  filter.appendChild(cm);

  const ct = document.createElementNS(SVG_NS, 'feComponentTransfer');
  const ft = document.createElementNS(SVG_NS, 'feFuncA');
  ft.setAttribute('type', 'gamma');
  ft.setAttribute('amplitude', '1');
  ft.setAttribute('exponent', '0.85');
  ft.setAttribute('offset', '0');
  ct.appendChild(ft);
  filter.appendChild(ct);
  defs.appendChild(filter);

  const mask = document.createElementNS(SVG_NS, 'mask');
  mask.setAttribute('id', `${uid}-mask`);
  mask.setAttribute('maskUnits', 'userSpaceOnUse');
  mask.setAttribute('x', '0');
  mask.setAttribute('y', '0');
  mask.setAttribute('width', String(W));
  mask.setAttribute('height', String(H));

  const image = document.createElementNS(SVG_NS, 'image');
  image.setAttributeNS(XLINK_NS, 'xlink:href', dataUrl);
  image.setAttribute('href', dataUrl);
  image.setAttribute('x', '0');
  image.setAttribute('y', '0');
  image.setAttribute('width', String(W));
  image.setAttribute('height', String(H));
  image.setAttribute('filter', `url(#${uid}-filter)`);
  image.setAttribute('preserveAspectRatio', 'none');
  mask.appendChild(image);
  defs.appendChild(mask);
  svg.appendChild(defs);

  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', '0');
  rect.setAttribute('y', '0');
  rect.setAttribute('width', String(W));
  rect.setAttribute('height', String(H));
  rect.setAttribute('fill', 'currentColor');
  rect.setAttribute('mask', `url(#${uid}-mask)`);
  svg.appendChild(rect);

  return svg;
}

/* ---------- Boot ---------- */
(async function boot() {
  initTheme();
  setMeta();
  buildEngravings();

  const store = createStore({
    quests: [],
    log: [],
    profile: {},
    heroes: [],
    realmStats: null,
    actionsLib: {},
    session: null,
  });

  // Expose for debugging
  window.__gq = { store, exportEverything };

  // 1. Public aggregates first — Hall of Fame + realm stats are visible
  //    even to signed-out visitors via SECURITY DEFINER RPCs, so we always
  //    pull them at boot. actionsLib stays as a static seed (UI helper data).
  const [heroes, realmStats, actionsLib] = await Promise.all([
    fetchHallOfFame(25),
    fetchRealmStats(),
    fetchJSON(CONFIG.actionsLib),
  ]);
  store.set('heroes', Array.isArray(heroes) ? heroes : []);
  store.set('realmStats', realmStats);
  store.set('actionsLib', actionsLib ?? {});

  // 2. Rehydrate from the Supabase session if one is already in
  //    localStorage (managed by supabase-js under `gq-auth`). Visitors
  //    without a session never hit the DB.
  try {
    const supaSession = await getSession();
    if (supaSession?.user) {
      currentUid = supaSession.user.id;
      await hydrateForUser(store, currentUid);
      const profile = store.get('profile') ?? {};
      store.set('session', shapeSession(supaSession, profile.name));
    }
  } catch (err) {
    console.error('[boot] resume failed:', err);
    showBootError(err?.message ?? 'Could not resume your chronicle.');
  }

  applyAuthState(store);

  initAuthDialog(store);
  initSignOut(store);
  initEditHero(store);
  initQuests({ store });
  initProgress({ store });
  initHall({ store });

  // Reactive rerender pipeline
  store.subscribe((key) => {
    if (key === 'session' || key === null) applyAuthState(store);
    if (key === 'quests' || key === 'log' || key === 'profile' || key === 'session' ||
        key === 'heroes' || key === 'realmStats' || key === null) {
      renderHeroRecap(store);
      refreshQuests();
      refreshHall();
      refreshChronicle();
    }
  });

  // Cross-tab + token-refresh sync. When Supabase emits SIGNED_IN /
  // SIGNED_OUT we mirror the state into the store so every open tab
  // stays consistent, and we re-hydrate the user's data on a fresh
  // sign-in (e.g. after an email-confirmation redirect).
  onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT' || !session?.user) {
      currentUid = null;
      store.patch({ quests: [], log: [], profile: {}, session: null });
      applyAuthState(store);
      return;
    }
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      const nextUid = session.user.id;
      // Avoid clobbering the store on every token refresh — only re-hydrate
      // when the user actually changed (or we never loaded them).
      if (nextUid !== currentUid) {
        currentUid = nextUid;
        try { await hydrateForUser(store, currentUid); }
        catch (err) { console.warn('[auth] state-change hydrate failed:', err); }
      }
      const profile = store.get('profile') ?? {};
      store.set('session', shapeSession(session, profile.name));
    }
  });

  renderHeroRecap(store);

  // New quest CTAs (only meaningful when signed in — CSS hides the
  // triggers otherwise, these guards just keep the callers honest).
  const openNew = () => {
    if (!store.get('session')) { openAuthDialog('signin'); return; }
    openQuestComposer({ store, mode: 'create' });
  };
  $('#newQuestBtn')?.addEventListener('click', openNew);
  $('#newQuestBtnInline')?.addEventListener('click', openNew);

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open-new-quest]');
    if (t) { e.preventDefault(); openNew(); }
  });

  // Secret export shortcut (Ctrl+Shift+E)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'E') {
      const blob = new Blob(
        [JSON.stringify(exportEverything(store), null, 2)],
        { type: 'application/json' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `goal-quest-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
      flashToast({ kind: 'success', title: 'Backup exported', desc: 'JSON saved to disk.' });
    }
    if (e.key === 'Escape') closeComposer();
  });
})();
