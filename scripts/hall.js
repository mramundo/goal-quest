/* =========================================================
   Goal Quest — Hall of Fame
   Blends seeded heroes with the player's current XP (sum of
   logged points) and produces a ranked leaderboard. No levels,
   no synthetic titles — just names, titles from seed, and XP.
   ========================================================= */

import { $, escapeHtml, fmt, computeMetrics } from './app.js';

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
  const profile = storeRef.get('profile') ?? {};

  const m = computeMetrics(quests, log);

  const you = {
    id: 'you',
    name: profile.name || 'Traveler',
    title: profile.title || 'Your chronicle',
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

    li.innerHTML = `
      <div class="hall-row__rank">${rank}</div>
      <div class="hall-row__body">
        <div class="hall-row__name">
          ${escapeHtml(h.name || '—')}
          ${h.you ? '<span class="hall-row__you">you</span>' : ''}
        </div>
        <div class="hall-row__title">${escapeHtml(h.title || '—')}</div>
      </div>
      <div class="hall-row__xp">
        <strong>${fmt.number(h.xp ?? 0)}</strong>
        <span>XP</span>
      </div>
    `;
    refs.list.appendChild(li);
  });
}
