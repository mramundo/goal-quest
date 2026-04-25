/* =========================================================
   Goal Quest — Progress module
   - Inline log composer (mounted inside expanded quest card)
   - Chronicle list render
   - Toast notifications (incl. chest-opened celebration)
   ========================================================= */

import {
  $, escapeHtml, escapeAttr, uid, clamp, fmt, progressFor,
  appendLog, updateQuest,
} from './app.js?v=20260425a';

let refs = {};
let storeRef = null;

/* =========================================================
   BOOT
   ========================================================= */
export function initProgress({ store }) {
  storeRef = store;
  refs = {
    logList:   $('#logList'),
    logEmpty:  $('#logEmpty'),
    toastRoot: $('#toastContainer'),
  };

  renderChronicle();
}

/* =========================================================
   CHRONICLE
   ========================================================= */
export function refreshChronicle() {
  renderChronicle();
}

function renderChronicle() {
  if (!refs.logList) return;
  const log    = storeRef.get('log') ?? [];
  const quests = storeRef.get('quests') ?? [];
  const byId   = new Map(quests.map(q => [q.id, q]));

  refs.logList.innerHTML = '';
  if (log.length === 0) {
    if (refs.logEmpty) refs.logEmpty.hidden = false;
    return;
  }
  if (refs.logEmpty) refs.logEmpty.hidden = true;

  const recent = log.slice(0, 40);
  recent.forEach((l, i) => {
    const quest = byId.get(l.questId);
    const row = document.createElement('div');
    row.className = 'log-row';
    row.style.animationDelay = `${Math.min(i, 12) * 25}ms`;
    row.innerHTML = `
      <div class="log-row__pts">+${Number(l.points) || 0}</div>
      <div class="log-row__body">
        <div class="log-row__what">${escapeHtml(l.action || '—')}</div>
        <div class="log-row__quest">${quest ? `<span aria-hidden="true">${escapeHtml(quest.icon || '📜')}</span> ${escapeHtml(quest.title || '')}` : 'Quest removed'}</div>
      </div>
      <time class="log-row__time" datetime="${escapeAttr(l.at)}">${fmt.relative(l.at)}</time>
    `;
    refs.logList.appendChild(row);
  });
}

/* =========================================================
   INLINE LOG COMPOSER (mounted into expanded quest card)
   ========================================================= */
export function renderLogComposer({ store, questId, mountInto }) {
  storeRef = store ?? storeRef;
  if (!mountInto) return;

  const q = (storeRef.get('quests') ?? []).find(x => x.id === questId);
  if (!q) return;

  const log = storeRef.get('log') ?? [];
  const currentProgress = progressFor(q, log);
  const maxAddable = Math.max(1, 100 - currentProgress);

  const lib = storeRef.get('actionsLib') ?? {};
  const topicLib = lib[q.topic] ?? lib.general ?? {
    label: 'General',
    presets: [
      { action: 'Small step', points: 2 },
      { action: 'Solid progress', points: 5 },
      { action: 'Big leap', points: 10 },
    ],
  };

  const draft = {
    action: topicLib.presets?.[0]?.action ?? '',
    points: clamp(topicLib.presets?.[0]?.points ?? 5, 1, maxAddable),
  };

  mountInto.innerHTML = `
    <form class="log-composer" data-log-form>
      <div>
        <h4 class="detail-section__title">Log an action · ${escapeHtml(topicLib.label || 'General')}</h4>
        <div class="preset-row" data-preset-row>
          ${(topicLib.presets ?? []).map(p => {
            const pts = clamp(Number(p.points) || 1, 1, maxAddable);
            return `
              <button type="button" class="preset-btn"
                      data-action="${escapeAttr(p.action)}"
                      data-points="${pts}">
                <strong>+${pts}</strong>
                <span>${escapeHtml(p.action)}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <label class="field">
        <span class="field__label">What did you do?</span>
        <input class="field__input" name="action" type="text" required
               placeholder="e.g. read a chapter" value="${escapeAttr(draft.action)}" />
      </label>

      <div class="field">
        <span class="field__label">How many points?</span>
        <input class="slider" type="range" name="points" min="1" max="${maxAddable}" step="1" value="${draft.points}" />
        <div class="points-display" aria-live="polite">
          <span class="points-display__plus">+</span>
          <span class="points-display__value" data-pts-value>${draft.points}</span>
          <span class="points-display__unit">pt</span>
        </div>
        <span class="field__hint">Max available to complete the quest: <strong>${maxAddable}</strong>pt.</span>
      </div>

      <div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
        <button type="button" class="btn btn--ghost btn--sm" data-log-cancel>Cancel</button>
        <button type="submit" class="btn btn--primary btn--sm">
          <svg width="14" height="14"><use href="#i-check"/></svg>
          Confirm
        </button>
      </div>
    </form>
  `;

  const form       = mountInto.querySelector('[data-log-form]');
  const presetRow  = mountInto.querySelector('[data-preset-row]');
  const pointsVal  = mountInto.querySelector('[data-pts-value]');
  const slider     = form.elements.points;
  const actionInp  = form.elements.action;

  presetRow?.addEventListener('click', (e) => {
    const btn = e.target.closest('.preset-btn');
    if (!btn) return;
    const pts = clamp(Number(btn.dataset.points) || 1, 1, maxAddable);
    actionInp.value = btn.dataset.action ?? '';
    slider.value = pts;
    pointsVal.textContent = pts;
  });

  slider.addEventListener('input', () => {
    const v = clamp(Number(slider.value) || 1, 1, maxAddable);
    pointsVal.textContent = v;
  });

  mountInto.querySelector('[data-log-cancel]')?.addEventListener('click', () => {
    mountInto.innerHTML = '';
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const action = actionInp.value.trim();
    if (!action) { actionInp.focus(); return; }
    const points = clamp(Number(slider.value) || 1, 1, maxAddable);

    const beforeProgress = progressFor(q, log);
    const alreadyUnlocked = (q.milestones ?? [])
      .filter(m => beforeProgress >= m.points)
      .map(m => m.id);

    appendLog(storeRef, {
      id: uid('l'),
      questId: q.id,
      action,
      points,
      at: new Date().toISOString(),
    });

    const afterLog = storeRef.get('log') ?? [];
    const afterProgress = progressFor(q, afterLog);
    const newlyUnlocked = (q.milestones ?? []).filter(m =>
      afterProgress >= m.points && !alreadyUnlocked.includes(m.id)
    );

    if (afterProgress >= 100 && !q.completedAt) {
      updateQuest(storeRef, q.id, { completedAt: new Date().toISOString() });
    }

    const biggest = newlyUnlocked.sort((a, b) => b.points - a.points)[0];
    if (biggest) {
      flashToast({
        kind: 'chest',
        title: `Chest opened — ${biggest.title || `${biggest.points}pt`}`,
        desc: biggest.reward
          ? `You earned: ${biggest.reward}`
          : `You reached ${biggest.points} pt on "${q.title}". Honor your promise!`,
        duration: 5000,
      });
    } else if (afterProgress >= 100) {
      flashToast({
        kind: 'chest',
        title: 'Quest complete!',
        desc: `"${q.title}" joins your legend.`,
        duration: 5000,
      });
    } else {
      flashToast({
        kind: 'success',
        title: `+${points} pt logged`,
        desc: `"${q.title}" — ${afterProgress}/100`,
      });
    }

    mountInto.innerHTML = '';
  });

  requestAnimationFrame(() => {
    mountInto.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    mountInto.querySelector('.preset-btn')?.focus({ preventScroll: true });
  });
}

/* =========================================================
   TOAST
   ========================================================= */
const ICON_BY_KIND = {
  chest:   '<svg width="18" height="18"><use href="#i-chest"/></svg>',
  success: '<svg width="18" height="18"><use href="#i-check"/></svg>',
  error:   '<svg width="18" height="18"><use href="#i-close"/></svg>',
  info:    '<svg width="18" height="18"><use href="#i-sparkle"/></svg>',
};

export function flashToast({ kind = 'success', title, desc, duration = 3200 }) {
  const container = $('#toastContainer') ?? (() => {
    const el = document.createElement('div');
    el.id = 'toastContainer';
    el.className = 'toast-container';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    document.body.appendChild(el);
    return el;
  })();

  const t = document.createElement('div');
  t.className = `toast toast--${kind}`;
  t.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  t.innerHTML = `
    <span class="toast__icon" aria-hidden="true">${ICON_BY_KIND[kind] ?? ICON_BY_KIND.info}</span>
    <div class="toast__body">
      ${title ? `<p class="toast__title">${escapeHtml(title)}</p>` : ''}
      ${desc  ? `<p class="toast__desc">${escapeHtml(desc)}</p>` : ''}
    </div>
    <button class="toast__close" type="button" aria-label="Dismiss">
      <svg width="14" height="14"><use href="#i-close"/></svg>
    </button>
  `;

  const dismiss = () => {
    t.style.animation = 'toast-out .25s var(--ease) forwards';
    setTimeout(() => t.remove(), 260);
  };

  t.querySelector('.toast__close')?.addEventListener('click', dismiss);
  container.appendChild(t);
  setTimeout(dismiss, duration);
}
