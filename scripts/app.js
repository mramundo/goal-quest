/* =========================================================
   Goal Quest — App entry point
   Wires up: theme, data load, persistent store, hero meta,
   livello del cavaliere, footer year. Delega il rendering
   alle tre sezioni (quests, hall, pergamena).
   ========================================================= */

import { initQuests, openQuestForm, refreshQuests } from './quests.js';
import { initProgress, openProgressModalFor, refreshPergamena, mountCelebration, flashToast } from './progress.js';
import { initHall, refreshHall } from './hall.js';

/* ---------- DOM helpers ---------- */
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Costanti ---------- */
const CONFIG = {
  seedQuests:   'data/quests.seed.json',
  seedHeroes:   'data/heroes.seed.json',
  actionsLib:   'data/actions-library.json',
};

const LOCALE = 'it-IT';
const REL_LOCALE = 'it';

const STORAGE = {
  palette: 'gq-palette',
  mode:    'gq-mode',
  quests:  'gq-quests',
  log:     'gq-log',
  profile: 'gq-profile',
  seeded:  'gq-seeded',  // flag: abbiamo già seminato gli esempi?
};

const PALETTES = ['pergamena', 'taverna', 'foresta-elfica', 'regno-ghiaccio'];
const MODES    = ['dark', 'light'];

/* Gradi del cavaliere — progressione XP -> livello + titolo */
const TITLES = [
  { lvl:  1, min:    0, name: 'Novizio' },
  { lvl:  2, min:  100, name: 'Scudiero' },
  { lvl:  3, min:  250, name: 'Cavaliere Errante' },
  { lvl:  4, min:  500, name: 'Cavaliere del Regno' },
  { lvl:  5, min: 1000, name: 'Campione' },
  { lvl:  6, min: 2000, name: 'Signore di Guerra' },
  { lvl:  7, min: 4000, name: 'Barone' },
  { lvl:  8, min: 8000, name: 'Conte' },
  { lvl:  9, min:16000, name: 'Duca' },
  { lvl: 10, min:32000, name: 'Leggenda' },
];

/* ---------- Store reattivo ---------- */
function createStore(initial = {}) {
  const listeners = new Set();
  const state = { ...initial };
  return {
    get: (key) => state[key],
    getAll: () => ({ ...state }),
    set(key, val) {
      state[key] = val;
      listeners.forEach(fn => fn(key, val, state));
    },
    patch(partial) {
      Object.assign(state, partial);
      listeners.forEach(fn => fn(null, null, state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/* ---------- Tema (palette + modalità) ---------- */
function initTheme() {
  const root = document.documentElement;

  // Palette
  let storedPalette = localStorage.getItem(STORAGE.palette);
  if (!PALETTES.includes(storedPalette)) storedPalette = 'pergamena';

  // Modalità (fallback a preferenza di sistema)
  let storedMode = localStorage.getItem(STORAGE.mode);
  if (!MODES.includes(storedMode)) {
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    storedMode = prefersLight ? 'light' : 'dark';
  }

  applyTheme(storedPalette, storedMode);

  // Toggle luce/buio
  $('#themeToggle')?.addEventListener('click', () => {
    const next = root.dataset.mode === 'light' ? 'dark' : 'light';
    applyTheme(root.dataset.palette, next);
    localStorage.setItem(STORAGE.mode, next);
  });

  // Palette picker
  const toggle = $('#paletteToggle');
  const menu   = $('#paletteMenu');
  if (toggle && menu) {
    const options = [...menu.querySelectorAll('.palette-picker__option')];

    const markCurrent = (palette) => {
      options.forEach(o => o.setAttribute('aria-current',
        o.dataset.palette === palette ? 'true' : 'false'));
    };
    markCurrent(storedPalette);

    const closeMenu = () => {
      menu.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    };
    const openMenu = () => {
      menu.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    };

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
}

/* ---------- Fetch JSON (solo seed, non scrive) ---------- */
async function fetchJSON(url) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[data] fetch fallita per ${url}:`, err.message);
    return null;
  }
}

/* ---------- Persistenza ---------- */
function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function saveLocal(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); }
  catch (err) { console.warn(`[storage] save fallita per ${key}:`, err); }
}

/* ---------- Livello / titolo ---------- */
export function levelFromXp(xp) {
  const safe = Math.max(0, Number(xp) || 0);
  let tier = TITLES[0];
  for (const t of TITLES) { if (safe >= t.min) tier = t; }
  const nextIdx = TITLES.findIndex(t => t.lvl === tier.lvl) + 1;
  const next = TITLES[nextIdx] ?? null;
  return {
    level: tier.lvl,
    title: tier.name,
    min: tier.min,
    next,
    toNext: next ? Math.max(0, next.min - safe) : 0,
    percentInLevel: next ? Math.min(100, Math.round(((safe - tier.min) / (next.min - tier.min)) * 100)) : 100,
  };
}

/* ---------- Utilità esportate ---------- */
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
    const rtf = new Intl.RelativeTimeFormat(REL_LOCALE, { numeric: 'auto' });
    if (Math.abs(diffMin) < 1) return 'adesso';
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

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
export function escapeAttr(s) { return escapeHtml(s).replace(/\s+/g, ' '); }

export function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

/* ---------- Calcoli sul grafo quests + log ---------- */
export function computeMetrics(quests, log) {
  const totalXp = log.reduce((s, l) => s + (Number(l.points) || 0), 0);
  const activeQuests = quests.filter(q => !q.completedAt).length;

  // Milestones sbloccate: ogni quest calcola progress dal log; confronta con soglia
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

/** Progress di una quest = somma punti loggati (cappata a 100). */
export function progressFor(quest, log) {
  const sum = log
    .filter(l => l.questId === quest.id)
    .reduce((s, l) => s + (Number(l.points) || 0), 0);
  return clamp(Math.round(sum), 0, 100);
}

/* ---------- Hero recap numeri ---------- */
function animateNumber(el, target) {
  if (!el || !Number.isFinite(target)) return;
  const duration = 700;
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(target * eased).toLocaleString(LOCALE);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function renderHeroRecap(store) {
  const quests = store.get('quests') ?? [];
  const log    = store.get('log') ?? [];
  const m = computeMetrics(quests, log);

  animateNumber($('#heroQuests'), m.activeQuests);
  animateNumber($('#heroXp'), m.totalXp);
  animateNumber($('#heroMilestones'), m.milestonesUnlocked);

  // Pill livello in topbar
  const lvl = levelFromXp(m.totalXp);
  const pill = $('#heroStat');
  if (pill) pill.textContent = `Lv ${lvl.level} · ${lvl.title}`;

  // Saluto hero
  const greet = $('#heroGreeting');
  if (greet) {
    const hour = new Date().getHours();
    const base = hour < 6 ? 'Le stelle vegliano'
               : hour < 12 ? 'Buon mattino, cavaliere'
               : hour < 18 ? 'Il sole illumina il tuo cammino'
               : 'Le torce sono accese';
    greet.textContent = m.activeQuests > 0 ? `${base} — ${m.activeQuests} quest ti attendono`
                                           : `${base} — la cronaca è pronta`;
  }
}

/* ---------- Footer meta ---------- */
function setMeta() {
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
  const fd = $('#footerData');
  if (fd) fd.textContent = 'localStorage';
}

/* ---------- Seed iniziale ---------- */
async function seedIfEmpty(store) {
  const already = localStorage.getItem(STORAGE.seeded) === '1';
  const quests = store.get('quests') ?? [];

  if (!already && quests.length === 0) {
    const seeds = await fetchJSON(CONFIG.seedQuests);
    if (Array.isArray(seeds?.items)) {
      const now = new Date().toISOString();
      const withIds = seeds.items.map(s => ({
        id: uid('q'),
        title: s.title,
        description: s.description ?? '',
        icon: s.icon ?? '📜',
        topic: s.topic ?? 'generale',
        createdAt: now,
        completedAt: null,
        milestones: (s.milestones ?? []).map(m => ({
          id: uid('m'),
          points: clamp(Number(m.points) || 0, 1, 99),
          title: m.title ?? '',
          reward: m.reward ?? '',
        })),
      }));
      store.set('quests', withIds);
      saveLocal(STORAGE.quests, withIds);
    }
    localStorage.setItem(STORAGE.seeded, '1');
  }
}

/* ---------- Mutazioni esportate ---------- */
export function addQuest(store, quest) {
  const list = [quest, ...(store.get('quests') ?? [])];
  store.set('quests', list);
  saveLocal(STORAGE.quests, list);
}
export function updateQuest(store, id, patch) {
  const list = (store.get('quests') ?? []).map(q => q.id === id ? { ...q, ...patch } : q);
  store.set('quests', list);
  saveLocal(STORAGE.quests, list);
}
export function removeQuest(store, id) {
  const list = (store.get('quests') ?? []).filter(q => q.id !== id);
  store.set('quests', list);
  saveLocal(STORAGE.quests, list);

  // pulizia log collegato
  const log = (store.get('log') ?? []).filter(l => l.questId !== id);
  store.set('log', log);
  saveLocal(STORAGE.log, log);
}
export function appendLog(store, entry) {
  const list = [entry, ...(store.get('log') ?? [])];
  store.set('log', list);
  saveLocal(STORAGE.log, list);
}
export function updateProfile(store, patch) {
  const profile = { ...(store.get('profile') ?? {}), ...patch };
  store.set('profile', profile);
  saveLocal(STORAGE.profile, profile);
}

export function exportEverything(store) {
  return {
    schema: 1,
    exportedAt: new Date().toISOString(),
    quests: store.get('quests') ?? [],
    log: store.get('log') ?? [],
    profile: store.get('profile') ?? {},
  };
}

/* ---------- Boot ---------- */
(async function boot() {
  initTheme();
  setMeta();

  // Store condiviso fra moduli
  const store = createStore({
    quests:      loadLocal(STORAGE.quests, []),
    log:         loadLocal(STORAGE.log, []),
    profile:     loadLocal(STORAGE.profile, { name: 'Tu', title: 'Aspirante cavaliere' }),
    heroes:      [],
    actionsLib:  {},
  });

  // Carica seed statici (solo letture)
  const [heroes, actionsLib] = await Promise.all([
    fetchJSON(CONFIG.seedHeroes),
    fetchJSON(CONFIG.actionsLib),
  ]);
  store.set('heroes', Array.isArray(heroes?.items) ? heroes.items : []);
  store.set('actionsLib', actionsLib ?? {});

  await seedIfEmpty(store);

  // Mount moduli
  mountCelebration();
  initQuests({ store });
  initProgress({ store });
  initHall({ store });

  // Reactive: ogni cambiamento di quests/log aggiorna tutto
  store.subscribe((key) => {
    if (key === 'quests' || key === 'log' || key === null) {
      renderHeroRecap(store);
      refreshQuests();
      refreshHall();
      refreshPergamena();
    }
  });

  // Primo render
  renderHeroRecap(store);

  // CTA "Forgia una nuova quest"
  $('#newQuestBtn')?.addEventListener('click', () => openQuestForm({ store, mode: 'create' }));

  // CTA empty state
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open-new-quest]');
    if (t) { e.preventDefault(); openQuestForm({ store, mode: 'create' }); }
  });

  // Diagnostica: shortcut segreto per esportare (utile in dev)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'E') {
      const blob = new Blob([JSON.stringify(exportEverything(store), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `goal-quest-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
      flashToast({ kind: 'success', text: 'Backup esportato sulla pergamena' });
    }
  });
})();
