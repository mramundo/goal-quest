/* =========================================================
   Goal Quest — App entry point
   Wires up: theme, Supabase session, reactive store, seed data,
   hero recap, footer meta. Delegates rendering to the three
   feature modules (quests, hall, chronicle). All user data lives
   in Supabase — localStorage only stores palette/mode preferences
   and the auth session (handled by the supabase-js client).
   ========================================================= */

import { initQuests, openQuestComposer, refreshQuests, closeComposer } from './quests.js';
import { initProgress, refreshChronicle, flashToast } from './progress.js';
import { initHall, refreshHall } from './hall.js';
import {
  ensureSession, loadAll, upsertProfile,
  insertQuest, patchQuest, deleteQuest,
  insertLog, seedInitialQuests,
} from './db.js';

/* ---------- DOM helpers ---------- */
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Constants ---------- */
const CONFIG = {
  seedQuests: 'data/quests.seed.json',
  seedHeroes: 'data/heroes.seed.json',
  actionsLib: 'data/actions-library.json',
};

const LOCALE = 'en-US';

// Only theme prefs live in localStorage now — user data is in Supabase.
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
  const profile = store.get('profile') ?? {};
  const m = computeMetrics(quests, log);

  animateNumber($('#heroQuests'), m.activeQuests);
  animateNumber($('#heroXp'), m.totalXp);
  animateNumber($('#heroMilestones'), m.milestonesUnlocked);

  const chipLabel = $('#heroChipLabel');
  if (chipLabel) chipLabel.textContent = profile.name || 'Traveler';

  const greet = $('#heroGreeting');
  if (greet) {
    const hour = new Date().getHours();
    const base = hour < 6 ? 'The stars keep watch'
               : hour < 12 ? 'Good morning'
               : hour < 18 ? 'The sun lights your road'
               : 'The torches are lit';
    const name = profile.name ? `, ${profile.name}` : '';
    greet.textContent = m.activeQuests > 0
      ? `${base}${name} — ${m.activeQuests} ${m.activeQuests === 1 ? 'quest awaits' : 'quests await'}`
      : `${base}${name} — your chronicle is ready`;
  }
}

/* ---------- Footer meta ---------- */
function setMeta() {
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
  const fd = $('#footerData');
  if (fd) fd.textContent = 'Supabase';
}

/* ---------- Store mutations ----------
   Pattern: optimistic in-memory update first (UI responds instantly),
   then fire the DB write. On failure we surface a toast and log the
   error — the user can refresh to re-hydrate from the source of truth. */

// Module-scoped user id — set at boot once ensureSession resolves.
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
  insertQuest(currentUid, quest).catch(err => surfaceDbError('addQuest', err));
}

export function updateQuest(store, id, patch) {
  const list = (store.get('quests') ?? []).map(q => q.id === id ? { ...q, ...patch } : q);
  store.set('quests', list);
  if (!currentUid) return;
  patchQuest(id, patch).catch(err => surfaceDbError('updateQuest', err));
}

export function removeQuest(store, id) {
  const list = (store.get('quests') ?? []).filter(q => q.id !== id);
  store.set('quests', list);

  // DB cascades logs, but we need to drop them from the local store too.
  const log = (store.get('log') ?? []).filter(l => l.questId !== id);
  store.set('log', log);

  if (!currentUid) return;
  deleteQuest(id).catch(err => surfaceDbError('removeQuest', err));
}

export function appendLog(store, entry) {
  const list = [entry, ...(store.get('log') ?? [])];
  store.set('log', list);
  if (!currentUid) return;
  insertLog(currentUid, entry).catch(err => surfaceDbError('appendLog', err));
}

export function updateProfile(store, patch) {
  const profile = { ...(store.get('profile') ?? {}), ...patch };
  store.set('profile', profile);
  if (!currentUid) return;
  upsertProfile(currentUid, profile).catch(err => surfaceDbError('updateProfile', err));
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

/* ---------- Onboarding (login) ---------- */
function hideOnboarding(section) {
  if (!section) return;
  section.hidden = true;
  section.style.display = 'none';
}
function showOnboarding(section) {
  if (!section) return;
  section.hidden = false;
  section.style.removeProperty('display');
}

function initOnboarding(store) {
  const section = $('#onboarding');
  const form = $('#loginForm');
  const input = $('#heroNameInput');
  if (!section || !form || !input) return;

  const profile = store.get('profile') ?? {};
  if (profile.name) {
    hideOnboarding(section);
    return;
  }

  showOnboarding(section);
  requestAnimationFrame(() => input.focus());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = input.value.trim().slice(0, 32);
    if (!name) { input.focus(); return; }

    // Hide overlay immediately for a responsive feel; the DB write
    // happens in the background and surfaces its own error toast.
    hideOnboarding(section);
    updateProfile(store, { name, title: 'Traveler' });

    flashToast({
      kind: 'success',
      title: `Welcome, ${name}`,
      desc: 'Your chronicle is open. Forge your first quest to begin.',
    });
  });
}

function initEditHero(store) {
  $('#editProfileBtn')?.addEventListener('click', () => {
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
  const onboarding = $('#onboarding');
  if (!onboarding) return;
  onboarding.hidden = false;
  onboarding.style.removeProperty('display');
  onboarding.innerHTML = `
    <div class="onboarding__card">
      <h1 class="onboarding__title">Can't reach the realm</h1>
      <p class="onboarding__lead" style="color: var(--danger);">${escapeHtml(message)}</p>
      <p class="onboarding__hint">Refresh after checking your connection.</p>
    </div>`;
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
    actionsLib: {},
  });

  // Expose for debugging
  window.__gq = { store, exportEverything };

  // 1. Get (or create) an anonymous Supabase session — RLS binds rows to auth.uid().
  let session;
  try {
    session = await ensureSession();
    currentUid = session.user.id;
  } catch (err) {
    console.error('[boot] auth failed:', err);
    showBootError(err.message ?? 'Authentication error');
    return;
  }

  // 2. Load seeds + user data in parallel.
  const [heroes, actionsLib, userData] = await Promise.all([
    fetchJSON(CONFIG.seedHeroes),
    fetchJSON(CONFIG.actionsLib),
    loadAll(currentUid),
  ]);
  store.set('heroes', Array.isArray(heroes?.items) ? heroes.items : []);
  store.set('actionsLib', actionsLib ?? {});
  store.patch({
    quests: userData.quests,
    log: userData.log,
    profile: userData.profile,
  });

  // 3. First-time user with no quests → drop in seed examples.
  await seedIfEmpty(store);

  initOnboarding(store);
  initEditHero(store);
  initQuests({ store });
  initProgress({ store });
  initHall({ store });

  // Reactive rerender pipeline
  store.subscribe((key) => {
    if (key === 'quests' || key === 'log' || key === 'profile' || key === null) {
      renderHeroRecap(store);
      refreshQuests();
      refreshHall();
      refreshChronicle();
    }
  });

  renderHeroRecap(store);

  // New quest CTAs
  const openNew = () => openQuestComposer({ store, mode: 'create' });
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
