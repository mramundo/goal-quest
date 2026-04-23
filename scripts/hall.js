/* =========================================================
   Goal Quest — Hall of Fame
   Mescola gli "eroi seed" del regno con lo stato corrente del
   giocatore (XP totale dal log) e produce la classifica.
   ========================================================= */

import {
  $, escapeHtml, fmt, computeMetrics, levelFromXp
} from './app.js';

let refs = {};
let storeRef = null;

export function initHall({ store }) {
  storeRef = store;
  refs = { list: $('#hallList') };
  render();
}

export function refreshHall() {
  render();
}

function render() {
  if (!refs.list) return;

  const quests  = storeRef.get('quests') ?? [];
  const log     = storeRef.get('log') ?? [];
  const heroes  = storeRef.get('heroes') ?? [];
  const profile = storeRef.get('profile') ?? { name: 'Tu', title: '' };

  const m = computeMetrics(quests, log);
  const lvl = levelFromXp(m.totalXp);

  // Tu come "eroe" aggiunto alla classifica
  const you = {
    id: 'you',
    name: profile.name || 'Tu',
    title: profile.title || lvl.title,
    xp: m.totalXp,
    you: true,
  };

  const all = [...heroes.map(h => ({ ...h })), you]
    .sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0));

  refs.list.innerHTML = '';
  all.forEach((h, i) => {
    const rank = i + 1;
    const li = document.createElement('li');
    li.className = 'hall-row';
    li.dataset.rank = rank;
    if (h.you) li.dataset.you = 'true';
    li.style.animationDelay = `${Math.min(i, 10) * 30}ms`;

    const subtitle = h.you
      ? `${h.title ?? '—'} · Lv ${lvl.level}`
      : (h.title ?? '—');

    li.innerHTML = `
      <div class="hall-row__rank">${rank}</div>
      <div class="hall-row__body">
        <div class="hall-row__name">${escapeHtml(h.name || '—')}${h.you ? ' <span style="color:var(--accent); font-size:.75em; margin-left:4px;">• tu</span>' : ''}</div>
        <div class="hall-row__title">${escapeHtml(subtitle)}</div>
      </div>
      <div class="hall-row__xp">
        <strong>${fmt.number(h.xp ?? 0)}</strong>
        <span>XP</span>
      </div>
    `;
    refs.list.appendChild(li);
  });
}
