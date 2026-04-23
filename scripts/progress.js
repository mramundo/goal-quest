/* =========================================================
   Goal Quest — Progress module
   - Modale "Registra un'azione" (preset + slider + testo libero)
   - Celebrazione forzieri (overlay)
   - Pergamena delle gesta (log cronologico)
   - Toast non-bloccanti
   ========================================================= */

import {
  $, escapeHtml, escapeAttr, uid, clamp, fmt, progressFor,
  appendLog, updateQuest
} from './app.js';

let refs = {};
let storeRef = null;

/* =========================================================
   BOOT
   ========================================================= */
export function initProgress({ store }) {
  storeRef = store;
  refs = {
    modal:     $('#progressModal'),
    logList:   $('#logList'),
    logEmpty:  $('#logEmpty'),
  };

  refs.modal?.addEventListener('click', (e) => {
    if (e.target === refs.modal) refs.modal.close();
    const closeBtn = e.target.closest('[data-modal-close]');
    if (closeBtn) refs.modal.close();
  });

  renderPergamena();
}

/* =========================================================
   PERGAMENA DELLE GESTA
   ========================================================= */
export function refreshPergamena() {
  renderPergamena();
}

function renderPergamena() {
  if (!refs.logList) return;
  const log    = storeRef.get('log') ?? [];
  const quests = storeRef.get('quests') ?? [];
  const byId = new Map(quests.map(q => [q.id, q]));

  refs.logList.innerHTML = '';
  if (log.length === 0) {
    refs.logEmpty.hidden = false;
    return;
  }
  refs.logEmpty.hidden = true;

  const recent = log.slice(0, 40);
  recent.forEach((l, i) => {
    const quest = byId.get(l.questId);
    const li = document.createElement('li');
    li.className = 'log-row';
    li.style.animationDelay = `${Math.min(i, 12) * 25}ms`;
    li.innerHTML = `
      <div class="log-row__points">+${Number(l.points) || 0}</div>
      <div class="log-row__body">
        <div class="log-row__action">${escapeHtml(l.action || '—')}</div>
        <div class="log-row__quest">${quest ? `${escapeHtml(quest.icon || '📜')} ${escapeHtml(quest.title || '')}` : 'Quest rimossa'}</div>
      </div>
      <time class="log-row__time" datetime="${escapeAttr(l.at)}">${fmt.relative(l.at)}</time>
    `;
    refs.logList.appendChild(li);
  });
}

/* =========================================================
   MODALE — Registra un'azione
   ========================================================= */
export function openProgressModalFor({ store, questId, onLogged }) {
  storeRef = store ?? storeRef;
  if (!refs.modal) refs.modal = $('#progressModal');

  const q = (storeRef.get('quests') ?? []).find(x => x.id === questId);
  if (!q) return;

  const log = storeRef.get('log') ?? [];
  const currentProgress = progressFor(q, log);
  const maxAddable = Math.max(1, 100 - currentProgress);

  // Presets dall'action library (per topic); fallback generico
  const lib = storeRef.get('actionsLib') ?? {};
  const topicLib = lib[q.topic] ?? lib.generale ?? {
    label: 'Generale',
    presets: [
      { action: 'Piccolo passo', points: 2 },
      { action: 'Progresso solido', points: 5 },
      { action: 'Salto di qualità', points: 10 },
    ],
  };

  let draft = {
    action: topicLib.presets?.[0]?.action ?? '',
    points: clamp(topicLib.presets?.[0]?.points ?? 5, 1, maxAddable),
  };

  refs.modal.innerHTML = `
    <form class="modal__inner" id="progressForm">
      <div class="modal__head">
        <h2><span aria-hidden="true">${escapeHtml(q.icon || '📜')}</span> Registra un'azione</h2>
        <p>${escapeHtml(q.title)} — stai a <strong>${currentProgress}</strong>/100 pt.</p>
      </div>

      <div class="modal__body">
        <div class="field">
          <span class="field__label">Azioni rapide · ${escapeHtml(topicLib.label || 'Generale')}</span>
          <div class="preset-grid" id="presetGrid">
            ${(topicLib.presets ?? []).map(p => `
              <button type="button" class="preset-btn" data-action="${escapeAttr(p.action)}" data-points="${clamp(Number(p.points) || 1, 1, 99)}">
                <strong>+${clamp(Number(p.points) || 1, 1, 99)}</strong>
                <span>${escapeHtml(p.action)}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="field">
          <span class="field__label">Cosa hai fatto?</span>
          <input class="field__input" name="action" type="text" required
                 placeholder="Es. letto un capitolo" value="${escapeAttr(draft.action)}" />
        </div>

        <div class="field">
          <span class="field__label">Quanti punti?</span>
          <input class="slider" type="range" name="points" min="1" max="${maxAddable}" step="1" value="${draft.points}" />
          <div class="points-display" aria-live="polite">
            <span class="points-display__plus">+</span>
            <span class="points-display__value" id="pointsValue">${draft.points}</span>
            <span class="points-display__unit">pt</span>
          </div>
          <span class="field__hint">Massimo disponibile per completare la quest: <strong>${maxAddable}</strong>pt.</span>
        </div>
      </div>

      <div class="modal__foot">
        <button type="button" class="btn btn--ghost" data-modal-close>Annulla</button>
        <button type="submit" class="btn btn--primary">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>
          Conferma
        </button>
      </div>
    </form>
  `;

  const form = refs.modal.querySelector('#progressForm');
  const pointsValue = refs.modal.querySelector('#pointsValue');
  const slider = form.elements.points;
  const actionInput = form.elements.action;

  // Preset click
  refs.modal.querySelector('#presetGrid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.preset-btn');
    if (!btn) return;
    const pts = clamp(Number(btn.dataset.points) || 1, 1, maxAddable);
    actionInput.value = btn.dataset.action ?? '';
    slider.value = pts;
    pointsValue.textContent = pts;
    draft.action = actionInput.value;
    draft.points = pts;
  });

  // Slider update
  slider.addEventListener('input', () => {
    const v = clamp(Number(slider.value) || 1, 1, maxAddable);
    pointsValue.textContent = v;
    draft.points = v;
  });

  // Submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const action = actionInput.value.trim();
    if (!action) { actionInput.focus(); return; }
    const points = clamp(Number(slider.value) || 1, 1, maxAddable);

    // Milestones sbloccate prima del log
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

    // Post-log: ricalcola progress e vedi se nuovi forzieri si sono aperti
    const afterLog = storeRef.get('log') ?? [];
    const afterProgress = progressFor(q, afterLog);
    const newlyUnlocked = (q.milestones ?? []).filter(m =>
      afterProgress >= m.points && !alreadyUnlocked.includes(m.id)
    );

    // Segna completamento quest
    if (afterProgress >= 100 && !q.completedAt) {
      updateQuest(storeRef, q.id, { completedAt: new Date().toISOString() });
    }

    refs.modal.close();

    // Celebrazione: prima il forziere più in alto
    const biggest = newlyUnlocked.sort((a, b) => b.points - a.points)[0];
    if (biggest) {
      showCelebration({
        title: biggest.title || 'Forziere aperto',
        desc:  biggest.reward
          ? `Ti sei guadagnato: ${biggest.reward}`
          : `Hai raggiunto i ${biggest.points} punti di "${q.title}". Onora la tua promessa!`,
      });
    } else if (afterProgress >= 100) {
      showCelebration({
        title: 'Quest completata!',
        desc:  `"${q.title}" è ora nella tua leggenda. Sali di rango, cavaliere.`,
      });
    } else {
      flashToast({ kind: 'success', text: `+${points} pt registrati su "${q.title}"` });
    }

    onLogged?.();
  });

  refs.modal.showModal();
  // Focus sul primo preset per usabilità tastiera
  requestAnimationFrame(() => {
    refs.modal.querySelector('.preset-btn')?.focus();
  });
}

/* =========================================================
   CELEBRAZIONE
   ========================================================= */
export function mountCelebration() {
  const el = $('#celebration');
  if (!el) return;
  // Click sul backdrop chiude
  el.addEventListener('click', (e) => {
    if (e.target === el) hideCelebration();
  });
  $('#celebrationDismiss')?.addEventListener('click', hideCelebration);
  // Native <dialog> chiude anche con ESC e 'cancel' event
  el.addEventListener('cancel', (e) => { e.preventDefault(); hideCelebration(); });
}

export function showCelebration({ title, desc }) {
  const el = $('#celebration');
  if (!el) return;
  $('#celebrationTitle').textContent = title ?? 'Forziere aperto';
  $('#celebrationDesc').textContent  = desc  ?? '';
  if (!el.open) el.showModal();
  requestAnimationFrame(() => $('#celebrationDismiss')?.focus());
}

export function hideCelebration() {
  const el = $('#celebration');
  if (el?.open) el.close();
}

/* =========================================================
   TOAST
   ========================================================= */
export function flashToast({ kind = 'success', text }) {
  let container = $('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `toast toast--${kind}`;
  t.innerHTML = `
    <span class="toast__dot" aria-hidden="true"></span>
    <span>${escapeHtml(text)}</span>
  `;
  container.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity .25s ease, transform .25s ease';
    t.style.opacity = '0';
    t.style.transform = 'translateY(6px)';
    setTimeout(() => t.remove(), 260);
  }, 2800);
}
