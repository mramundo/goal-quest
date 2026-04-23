/* =========================================================
   Goal Quest — Quests module
   - Rendering della quest-list con filtri e ricerca
   - Drawer laterale di dettaglio (milestones, log collegato)
   - Modale "Forgia/Modifica quest" con editor delle tappe
   ========================================================= */

import {
  $, $$, escapeHtml, escapeAttr, uid, clamp,
  fmt, progressFor,
  addQuest, updateQuest, removeQuest
} from './app.js';
import { openProgressModalFor } from './progress.js';

/* Stato modulo */
let refs = {};
let storeRef = null;
let viewState = {
  filter: 'all',  // all | active | done
  query: '',
};

/* Emoji proposte per la picker del form quest */
const ICON_CHOICES = ['📚','📖','🏋️','🏃','🥗','🧘','💰','🎨','🎵','🎯','⚔️','🛡️','🗺️','🏰','🐉','🌱','🧠','✍️','🧳','💤','🎓','🔨','🧹','💧','🍵','🪄'];

/* =========================================================
   BOOT
   ========================================================= */
export function initQuests({ store }) {
  storeRef = store;
  refs = {
    list:    $('#questList'),
    empty:   $('#questsEmpty'),
    search:  $('#questsSearch'),
    filters: $$('#quests-section .filters .chip'),
    drawer:  $('#questDrawer'),
    modal:   $('#questModal'),
  };

  // Filtri
  refs.filters.forEach(btn => {
    btn.addEventListener('click', () => {
      refs.filters.forEach(b => {
        b.classList.remove('chip--active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('chip--active');
      btn.setAttribute('aria-selected', 'true');
      viewState.filter = btn.dataset.filter ?? 'all';
      renderList();
    });
  });

  // Ricerca (debounce)
  let t;
  refs.search?.addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      viewState.query = e.target.value.trim().toLowerCase();
      renderList();
    }, 160);
  });

  // Click sulle card della lista -> drawer
  refs.list?.addEventListener('click', (e) => {
    const card = e.target.closest('.quest-card');
    if (!card) return;
    const id = card.dataset.id;
    if (id) openDrawer(id);
  });
  refs.list?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.quest-card');
    if (!card) return;
    e.preventDefault();
    openDrawer(card.dataset.id);
  });

  // Dismiss drawer
  refs.drawer?.addEventListener('click', (e) => {
    if (e.target === refs.drawer) refs.drawer.close();
    const closeBtn = e.target.closest('[data-drawer-close]');
    if (closeBtn) refs.drawer.close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && refs.drawer?.open) refs.drawer.close();
  });

  // Dismiss modale
  refs.modal?.addEventListener('click', (e) => {
    if (e.target === refs.modal) refs.modal.close();
    const closeBtn = e.target.closest('[data-modal-close]');
    if (closeBtn) refs.modal.close();
  });

  renderList();
}

/* =========================================================
   LISTA
   ========================================================= */
export function refreshQuests() {
  renderList();
  // Se il drawer è aperto, aggiorna il contenuto
  if (refs.drawer?.open && refs.drawer.dataset.questId) {
    openDrawer(refs.drawer.dataset.questId, { skipOpen: true });
  }
}

function getFilteredQuests() {
  const quests = storeRef.get('quests') ?? [];
  const log    = storeRef.get('log') ?? [];
  let list = quests.map(q => ({ ...q, progress: progressFor(q, log) }));

  if (viewState.filter === 'active') list = list.filter(q => !q.completedAt && q.progress < 100);
  if (viewState.filter === 'done')   list = list.filter(q =>  q.completedAt || q.progress >= 100);

  if (viewState.query) {
    const q = viewState.query;
    list = list.filter(qu =>
      (qu.title ?? '').toLowerCase().includes(q) ||
      (qu.description ?? '').toLowerCase().includes(q) ||
      (qu.topic ?? '').toLowerCase().includes(q)
    );
  }

  return list.sort((a, b) => {
    // attive prima, poi quelle con maggior progresso
    const aDone = a.completedAt || a.progress >= 100 ? 1 : 0;
    const bDone = b.completedAt || b.progress >= 100 ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    if (b.progress !== a.progress) return b.progress - a.progress;
    return new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0);
  });
}

function renderList() {
  if (!refs.list) return;
  const list = getFilteredQuests();

  refs.list.innerHTML = '';
  if (list.length === 0) {
    refs.empty.hidden = false;
    return;
  }
  refs.empty.hidden = true;

  const log = storeRef.get('log') ?? [];
  list.forEach((q, i) => {
    refs.list.appendChild(buildCard(q, log, i));
  });
}

function buildCard(q, log, i) {
  const li = document.createElement('li');
  li.className = 'quest-card';
  li.style.animationDelay = `${Math.min(i, 8) * 40}ms`;
  li.tabIndex = 0;
  li.dataset.id = q.id;
  const done = q.completedAt || q.progress >= 100;
  li.dataset.state = done ? 'done' : 'active';

  const milestones = (q.milestones ?? []).slice().sort((a, b) => a.points - b.points);
  const milestonesCount = milestones.length;
  const milestonesUnlocked = milestones.filter(m => q.progress >= m.points).length;

  const pipsHtml = milestones.map(m => {
    const unlocked = q.progress >= m.points;
    return `<span class="quest-card__milestone" data-unlocked="${unlocked}" title="${escapeAttr(`${m.points}pt — ${m.title || m.reward || ''}`)}">${m.points}</span>`;
  }).join('');

  const stateLabel = done ? 'Completata' : `${q.progress}%`;
  const stateClass = done ? 'quest-card__state--done' : 'quest-card__state--active';

  li.innerHTML = `
    <div class="quest-card__head">
      <div class="quest-card__icon" aria-hidden="true">${escapeHtml(q.icon || '📜')}</div>
      <div class="quest-card__body">
        <h3 class="quest-card__title">${escapeHtml(q.title || 'Quest senza nome')}</h3>
        ${q.description ? `<p class="quest-card__desc">${escapeHtml(q.description)}</p>` : ''}
      </div>
      <div class="quest-card__state ${stateClass}">${stateLabel}</div>
    </div>

    <div class="quest-card__progress">
      <div class="progress" role="progressbar" aria-valuenow="${q.progress}" aria-valuemin="0" aria-valuemax="100">
        <div class="progress__bar" style="width:${q.progress}%"></div>
      </div>
      <div class="quest-card__meta">
        <span><strong>${q.progress}</strong>/100 pt</span>
        <span>${milestonesUnlocked}/${milestonesCount} forzieri</span>
      </div>
    </div>

    ${milestonesCount ? `<div class="quest-card__milestones">${pipsHtml}</div>` : ''}
  `;
  return li;
}

/* =========================================================
   DRAWER — dettaglio quest
   ========================================================= */
function openDrawer(id, { skipOpen = false } = {}) {
  const q = (storeRef.get('quests') ?? []).find(x => x.id === id);
  if (!q) return;

  const log = storeRef.get('log') ?? [];
  const progress = progressFor(q, log);
  const milestones = (q.milestones ?? []).slice().sort((a, b) => a.points - b.points);
  const unlockedCount = milestones.filter(m => progress >= m.points).length;

  const xpFromThis = log
    .filter(l => l.questId === q.id)
    .reduce((s, l) => s + (Number(l.points) || 0), 0);

  const nextMs = milestones.find(m => progress < m.points);

  const recentLog = log.filter(l => l.questId === q.id).slice(0, 6);

  refs.drawer.dataset.questId = q.id;
  refs.drawer.innerHTML = `
    <div class="drawer__head">
      <h2>
        <span aria-hidden="true">${escapeHtml(q.icon || '📜')}</span>
        ${escapeHtml(q.title || 'Quest')}
      </h2>
      <button class="drawer__close" data-drawer-close aria-label="Chiudi">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>

    <div class="drawer__body">
      ${q.description ? `<p style="color:var(--text-muted); margin:0;">${escapeHtml(q.description)}</p>` : ''}

      <section class="drawer__section">
        <h3 class="drawer__section-title">Progresso</h3>
        <div class="progress progress--lg" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress__bar" style="width:${progress}%"></div>
        </div>
        <div class="detail-stat-grid" style="margin-top:14px;">
          <div class="detail-stat">
            <div class="detail-stat__value">${progress}</div>
            <div class="detail-stat__label">punti su 100</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat__value">${fmt.number(xpFromThis)}</div>
            <div class="detail-stat__label">XP accumulati</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat__value">${unlockedCount}/${milestones.length || 0}</div>
            <div class="detail-stat__label">forzieri aperti</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat__value">${nextMs ? `+${Math.max(0, nextMs.points - progress)}` : '✓'}</div>
            <div class="detail-stat__label">${nextMs ? 'al prossimo forziere' : 'quest colma'}</div>
          </div>
        </div>
      </section>

      <section class="drawer__section">
        <h3 class="drawer__section-title">Forzieri</h3>
        ${milestones.length ? milestones.map(m => {
          const unlocked = progress >= m.points;
          return `
            <div class="milestone-row" data-unlocked="${unlocked}">
              <div class="milestone-row__points">${m.points}pt</div>
              <div class="milestone-row__body">
                <div class="milestone-row__title">${escapeHtml(m.title || '—')}</div>
                ${m.reward ? `<div class="milestone-row__reward">🎁 ${escapeHtml(m.reward)}</div>` : ''}
              </div>
              <div class="milestone-row__badge">${unlocked ? 'Aperto' : 'Sigillato'}</div>
            </div>`;
        }).join('') : `<p style="color:var(--text-dim); font-size:.9rem;">Nessun forziere. Aggiungi delle tappe premio modificando la quest.</p>`}
      </section>

      ${recentLog.length ? `
        <section class="drawer__section">
          <h3 class="drawer__section-title">Ultime gesta</h3>
          <ol class="log-list" style="padding:0; gap:6px;">
            ${recentLog.map(l => `
              <li class="log-row">
                <div class="log-row__points">+${l.points}</div>
                <div class="log-row__body">
                  <div class="log-row__action">${escapeHtml(l.action || '—')}</div>
                  <div class="log-row__quest">${fmt.relative(l.at)}</div>
                </div>
              </li>
            `).join('')}
          </ol>
        </section>
      ` : ''}

      <section class="drawer__section drawer__actions">
        <button class="btn btn--primary" data-drawer-log><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>Registra un'azione</button>
        <button class="btn btn--ghost" data-drawer-edit>Modifica</button>
        <button class="btn btn--danger" data-drawer-delete>Elimina</button>
      </section>
    </div>
  `;

  // Wiring
  refs.drawer.querySelector('[data-drawer-log]')?.addEventListener('click', () => {
    openProgressModalFor({ store: storeRef, questId: q.id, onLogged: () => {
      openDrawer(q.id, { skipOpen: true });
    }});
  });
  refs.drawer.querySelector('[data-drawer-edit]')?.addEventListener('click', () => {
    refs.drawer.close();
    openQuestForm({ store: storeRef, mode: 'edit', questId: q.id });
  });
  refs.drawer.querySelector('[data-drawer-delete]')?.addEventListener('click', () => {
    if (confirm(`Sei sicuro di voler eliminare "${q.title}"? Perderai anche le gesta collegate.`)) {
      removeQuest(storeRef, q.id);
      refs.drawer.close();
    }
  });

  if (!skipOpen) refs.drawer.showModal();
}

/* =========================================================
   MODALE — Forgia / Modifica quest
   ========================================================= */
export function openQuestForm({ store, mode = 'create', questId = null }) {
  storeRef = store ?? storeRef;
  if (!refs.modal) refs.modal = $('#questModal');

  const existing = mode === 'edit'
    ? (storeRef.get('quests') ?? []).find(q => q.id === questId)
    : null;

  // Draft locale (milestones modificabili prima del submit)
  const draft = {
    title: existing?.title ?? '',
    description: existing?.description ?? '',
    icon: existing?.icon ?? '📜',
    topic: existing?.topic ?? 'generale',
    milestones: existing
      ? (existing.milestones ?? []).map(m => ({ ...m }))
      : [
          { id: uid('m'), points: 25, title: 'Primo passo', reward: '' },
          { id: uid('m'), points: 50, title: 'Metà strada',  reward: '' },
          { id: uid('m'), points: 75, title: 'Quasi fatta',  reward: '' },
        ],
  };

  const title = mode === 'edit' ? 'Modifica la quest' : 'Forgia una nuova quest';
  const cta   = mode === 'edit' ? 'Salva modifiche'    : 'Crea la quest';

  refs.modal.innerHTML = `
    <form class="modal__inner" id="questForm" novalidate>
      <div class="modal__head">
        <h2>${title}</h2>
        <p>Dai un nome all'impresa, scegli un'icona e definisci le tappe-premio.</p>
      </div>

      <div class="modal__body">
        <label class="field">
          <span class="field__label">Nome della quest</span>
          <input class="field__input" name="title" type="text" required
                 placeholder="Es. Leggere 10 libri entro l'anno" value="${escapeAttr(draft.title)}" />
          <span class="field__hint">Sii specifico: un obiettivo chiaro è metà della vittoria.</span>
        </label>

        <label class="field">
          <span class="field__label">Descrizione <em style="font-style:normal; color:var(--text-dim); font-weight:400;">(facoltativa)</em></span>
          <textarea class="field__textarea" name="description" rows="2"
                    placeholder="Perché la scegli? Quali benefici ti aspetti?">${escapeHtml(draft.description)}</textarea>
        </label>

        <div class="field-row field-row--3">
          <label class="field">
            <span class="field__label">Tema</span>
            <select class="field__select" name="topic">
              <option value="generale">Generale</option>
              <option value="lettura">Lettura</option>
              <option value="sport">Sport</option>
              <option value="salute">Salute</option>
              <option value="risparmio">Risparmio</option>
              <option value="studio">Studio</option>
              <option value="creativita">Creatività</option>
              <option value="viaggi">Viaggi</option>
              <option value="casa">Casa</option>
            </select>
          </label>

          <div class="field" style="grid-column: span 2;">
            <span class="field__label">Icona</span>
            <div class="icon-picker" id="iconPicker">
              ${ICON_CHOICES.map(ic => `
                <button type="button" class="icon-picker__btn" data-icon="${escapeAttr(ic)}" aria-pressed="${ic === draft.icon}">${ic}</button>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="field">
          <span class="field__label">Tappe / Forzieri</span>
          <span class="field__hint">Ogni tappa ha un valore (1-99pt) e un premio che ti regalerai al raggiungimento. Al 100 la quest è completa.</span>

          <div id="milestoneEditor"></div>

          <button type="button" class="btn btn--ghost" id="addMilestoneBtn" style="margin-top:6px; align-self:flex-start;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            Aggiungi tappa
          </button>
        </div>
      </div>

      <div class="modal__foot">
        <button type="button" class="btn btn--ghost" data-modal-close>Annulla</button>
        <button type="submit" class="btn btn--primary">${cta}</button>
      </div>
    </form>
  `;

  const form = refs.modal.querySelector('#questForm');
  const iconPicker = refs.modal.querySelector('#iconPicker');
  const msEditor   = refs.modal.querySelector('#milestoneEditor');
  const addBtn     = refs.modal.querySelector('#addMilestoneBtn');

  // Select initial topic
  form.elements.topic.value = draft.topic;

  // Icon picker
  iconPicker.addEventListener('click', (e) => {
    const btn = e.target.closest('.icon-picker__btn');
    if (!btn) return;
    draft.icon = btn.dataset.icon;
    iconPicker.querySelectorAll('.icon-picker__btn').forEach(b =>
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false')
    );
  });

  // Milestone editor
  function renderMilestones() {
    msEditor.innerHTML = draft.milestones.map((m, idx) => `
      <div class="milestone-editor" data-idx="${idx}">
        <div class="milestone-editor__head">
          <input class="milestone-editor__pts" type="number" min="1" max="99" step="1"
                 value="${clamp(Number(m.points) || 1, 1, 99)}" aria-label="Punti tappa" />
          <input class="milestone-editor__title" type="text" placeholder="Nome della tappa"
                 value="${escapeAttr(m.title || '')}" aria-label="Nome tappa" />
          <button type="button" class="milestone-editor__remove" aria-label="Rimuovi tappa">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>
          </button>
        </div>
        <input class="milestone-editor__reward" type="text" placeholder="🎁 Premio al raggiungimento (es. Nuovo libro, cena fuori, un'ora di relax)"
               value="${escapeAttr(m.reward || '')}" aria-label="Premio" />
      </div>
    `).join('') || `<p style="color:var(--text-dim); font-size:.9rem; margin:0;">Nessuna tappa. Aggiungine una per rendere la quest gratificante.</p>`;
  }
  renderMilestones();

  msEditor.addEventListener('input', (e) => {
    const row = e.target.closest('.milestone-editor');
    if (!row) return;
    const idx = Number(row.dataset.idx);
    const m = draft.milestones[idx];
    if (!m) return;
    if (e.target.classList.contains('milestone-editor__pts')) {
      m.points = clamp(Number(e.target.value) || 1, 1, 99);
    } else if (e.target.classList.contains('milestone-editor__title')) {
      m.title = e.target.value;
    } else if (e.target.classList.contains('milestone-editor__reward')) {
      m.reward = e.target.value;
    }
  });
  msEditor.addEventListener('click', (e) => {
    const rm = e.target.closest('.milestone-editor__remove');
    if (!rm) return;
    const row = rm.closest('.milestone-editor');
    const idx = Number(row.dataset.idx);
    draft.milestones.splice(idx, 1);
    renderMilestones();
  });

  addBtn.addEventListener('click', () => {
    // Suggerisce un valore non collidente
    const used = new Set(draft.milestones.map(m => m.points));
    let suggestion = 10;
    while (used.has(suggestion) && suggestion < 99) suggestion += 10;
    draft.milestones.push({ id: uid('m'), points: suggestion, title: '', reward: '' });
    renderMilestones();
  });

  // Submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.elements.title.value.trim();
    if (!title) {
      form.elements.title.focus();
      return;
    }
    const description = form.elements.description.value.trim();
    const topic = form.elements.topic.value;

    // Sanitizza + ordina milestones
    const cleanMilestones = draft.milestones
      .map(m => ({
        id: m.id ?? uid('m'),
        points: clamp(Number(m.points) || 1, 1, 99),
        title: (m.title ?? '').trim(),
        reward: (m.reward ?? '').trim(),
      }))
      .filter(m => m.points > 0 && m.points < 100)
      .sort((a, b) => a.points - b.points);

    if (mode === 'edit' && existing) {
      updateQuest(storeRef, existing.id, {
        title, description, topic, icon: draft.icon,
        milestones: cleanMilestones,
      });
    } else {
      addQuest(storeRef, {
        id: uid('q'),
        title, description, topic, icon: draft.icon,
        createdAt: new Date().toISOString(),
        completedAt: null,
        milestones: cleanMilestones,
      });
    }

    refs.modal.close();
  });

  refs.modal.showModal();
}
