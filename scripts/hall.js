/* =========================================================
   Goal Quest — Hall of Fame
   Renders the leaderboard from the `hall_of_fame` SECURITY DEFINER
   RPC (see scripts/db.js + the matching migration). Rows are sorted
   server-side by XP DESC; the signed-in user's row is flagged with
   `data-you="true"` for the highlight stripe.
   ========================================================= */

import { $, escapeHtml, fmt } from './app.js?v=20260425a';

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

  const heroes  = storeRef.get('heroes') ?? [];
  const session = storeRef.get('session');
  const myId    = session?.userId ?? null;

  refs.list.innerHTML = '';

  if (heroes.length === 0) {
    const li = document.createElement('li');
    li.className = 'hall-row hall-row--empty';
    li.innerHTML = `
      <div class="hall-row__body">
        <div class="hall-row__name">No heroes yet</div>
        <div class="hall-row__title">Be the first to climb the leaderboard.</div>
      </div>
    `;
    refs.list.appendChild(li);
    return;
  }

  heroes.forEach((h, i) => {
    const rank = i + 1;
    const isYou = myId && h.userId === myId;
    const li = document.createElement('li');
    li.className = 'hall-row';
    li.dataset.rank = rank;
    if (isYou) li.dataset.you = 'true';
    li.style.animationDelay = `${Math.min(i, 10) * 30}ms`;

    li.innerHTML = `
      <div class="hall-row__rank">${rank}</div>
      <div class="hall-row__body">
        <div class="hall-row__name">
          ${escapeHtml(h.name || '—')}
          ${isYou ? '<span class="hall-row__you">you</span>' : ''}
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
