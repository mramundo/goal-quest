/* =========================================================
   Goal Quest — Quests module
   - Renders the quest list (filter + search)
   - Expands a quest inline (no side drawer, no modal)
   - Inline composer (create/edit) mounted in #composerSlot
   ========================================================= */

import {
  $, $$, escapeHtml, escapeAttr, uid, clamp,
  fmt, progressFor,
  addQuest, updateQuest, removeQuest,
} from './app.js?v=20260425a';
import { renderLogComposer } from './progress.js?v=20260425a';

/* Module state */
let refs = {};
let storeRef = null;
let viewState = {
  filter: 'all',
  query: '',
  expandedId: null,
};

/* Topic options shown in composer select */
const TOPIC_CHOICES = [
  { value: 'general',  label: 'General' },
  { value: 'reading',  label: 'Reading' },
  { value: 'fitness',  label: 'Fitness' },
  { value: 'health',   label: 'Health' },
  { value: 'savings',  label: 'Savings' },
  { value: 'study',    label: 'Study' },
  { value: 'creative', label: 'Creative' },
  { value: 'travel',   label: 'Travel' },
  { value: 'home',     label: 'Home' },
];

const ICON_CHOICES = [
  '📚','📖','🏋️','🏃','🥗','🧘','💰','🎨','🎵','🎯',
  '⚔️','🛡️','🗺️','🏰','🐉','🌱','🧠','✍️','🧳','💤',
  '🎓','🔨','🧹','💧','🍵','🪄','🏹','🧗','🎸','🌟',
];

/* =========================================================
   BOOT
   ========================================================= */
export function initQuests({ store }) {
  storeRef = store;
  refs = {
    list:     $('#questList'),
    empty:    $('#questsEmpty'),
    search:   $('#questsSearch'),
    filters:  $$('#quests-section .filters .chip'),
    composer: $('#composerSlot'),
  };

  // Filter chips
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

  // Debounced search
  let t;
  refs.search?.addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      viewState.query = e.target.value.trim().toLowerCase();
      renderList();
    }, 160);
  });

  // Card click / keypress -> expand inline
  refs.list?.addEventListener('click', (e) => {
    // Stop bubbling from buttons inside detail
    if (e.target.closest('[data-detail-action]')) return;
    if (e.target.closest('.log-composer')) return;
    const card = e.target.closest('.quest-card');
    if (!card) return;
    const id = card.dataset.id;
    if (!id) return;
    toggleExpand(id);
  });
  refs.list?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.closest('input, textarea, select, button')) return;
    const card = e.target.closest('.quest-card');
    if (!card) return;
    e.preventDefault();
    toggleExpand(card.dataset.id);
  });

  renderList();
}

/* =========================================================
   LIST
   ========================================================= */
export function refreshQuests() {
  renderList();
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
    const label = `${m.points}pt — ${m.title || m.reward || ''}`.trim();
    return `<span class="quest-card__pip" data-unlocked="${unlocked}" title="${escapeAttr(label)}">${m.points}</span>`;
  }).join('');

  const stateLabel = done ? 'Done' : `${q.progress}%`;
  const stateClass = done ? 'quest-card__state--done' : 'quest-card__state--active';

  li.innerHTML = `
    <div class="quest-card__head">
      <div class="quest-card__icon" aria-hidden="true">${escapeHtml(q.icon || '📜')}</div>
      <div class="quest-card__body">
        <h3 class="quest-card__title">${escapeHtml(q.title || 'Untitled quest')}</h3>
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
        <span>${milestonesUnlocked}/${milestonesCount} chests</span>
      </div>
    </div>

    ${milestonesCount ? `<div class="quest-card__pips">${pipsHtml}</div>` : ''}
  `;

  // Expanded detail (inline)
  if (viewState.expandedId === q.id) {
    li.dataset.expanded = 'true';
    li.appendChild(buildDetail(q, log));
  }

  return li;
}

function buildDetail(q, log) {
  const progress = progressFor(q, log);
  const milestones = (q.milestones ?? []).slice().sort((a, b) => a.points - b.points);
  const unlockedCount = milestones.filter(m => progress >= m.points).length;

  const xpFromThis = log
    .filter(l => l.questId === q.id)
    .reduce((s, l) => s + (Number(l.points) || 0), 0);

  const nextMs = milestones.find(m => progress < m.points);
  const recentLog = log.filter(l => l.questId === q.id).slice(0, 5);

  const wrap = document.createElement('div');
  wrap.className = 'quest-card__detail';
  wrap.innerHTML = `
    <section>
      <h4 class="detail-section__title">Progress</h4>
      <div class="progress progress--lg" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
        <div class="progress__bar" style="width:${progress}%"></div>
      </div>
      <div class="detail-stats" style="margin-top:12px;">
        <div class="detail-stat">
          <div class="detail-stat__value">${progress}</div>
          <div class="detail-stat__label">points / 100</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat__value">${fmt.number(xpFromThis)}</div>
          <div class="detail-stat__label">XP earned</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat__value">${unlockedCount}/${milestones.length || 0}</div>
          <div class="detail-stat__label">chests opened</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat__value">${nextMs ? `+${Math.max(0, nextMs.points - progress)}` : '✓'}</div>
          <div class="detail-stat__label">${nextMs ? 'to next chest' : 'quest full'}</div>
        </div>
      </div>
    </section>

    <section>
      <h4 class="detail-section__title">Chests</h4>
      ${milestones.length ? milestones.map(m => {
        const unlocked = progress >= m.points;
        return `
          <div class="milestone-row" data-unlocked="${unlocked}">
            <div class="milestone-row__pts">${m.points}pt</div>
            <div class="milestone-row__body">
              <div class="milestone-row__title">${escapeHtml(m.title || '—')}</div>
              ${m.reward ? `<div class="milestone-row__reward">🎁 ${escapeHtml(m.reward)}</div>` : ''}
            </div>
            <div class="milestone-row__badge">${unlocked ? 'Open' : 'Sealed'}</div>
          </div>`;
      }).join('') : `<p style="color:var(--text-dim); font-size:.88rem; margin:0;">No chests yet. Edit the quest to add rewarding milestones.</p>`}
    </section>

    ${recentLog.length ? `
      <section>
        <h4 class="detail-section__title">Recent actions</h4>
        ${recentLog.map(l => `
          <div class="recent-action">
            <div class="recent-action__pts">+${l.points}</div>
            <div class="recent-action__what">${escapeHtml(l.action || '—')}</div>
            <div class="recent-action__time">${fmt.relative(l.at)}</div>
          </div>
        `).join('')}
      </section>
    ` : ''}

    <section data-log-slot></section>

    <div class="detail-actions">
      <button class="btn btn--primary" data-detail-action="log">
        <svg width="16" height="16"><use href="#i-plus"/></svg>
        Log an action
      </button>
      <button class="btn btn--ghost" data-detail-action="edit">
        <svg width="14" height="14"><use href="#i-edit"/></svg>
        Edit
      </button>
      <button class="btn btn--danger" data-detail-action="delete">
        <svg width="14" height="14"><use href="#i-trash"/></svg>
        Delete
      </button>
    </div>
  `;

  // Action wiring
  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-detail-action]');
    if (!btn) return;
    e.stopPropagation();
    const action = btn.dataset.detailAction;
    if (action === 'log') {
      renderLogComposer({
        store: storeRef,
        questId: q.id,
        mountInto: wrap.querySelector('[data-log-slot]'),
      });
    } else if (action === 'edit') {
      openQuestComposer({ store: storeRef, mode: 'edit', questId: q.id });
    } else if (action === 'delete') {
      if (confirm(`Delete "${q.title}"? Linked actions will be removed too.`)) {
        viewState.expandedId = null;
        removeQuest(storeRef, q.id);
      }
    }
  });

  return wrap;
}

function toggleExpand(id) {
  viewState.expandedId = viewState.expandedId === id ? null : id;
  renderList();
  if (viewState.expandedId === id) {
    requestAnimationFrame(() => {
      const card = refs.list?.querySelector(`.quest-card[data-id="${id}"]`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
}

/* =========================================================
   INLINE COMPOSER (create / edit quest)
   ========================================================= */
export function closeComposer() {
  if (!refs.composer) refs.composer = $('#composerSlot');
  if (refs.composer) refs.composer.innerHTML = '';
}

export function openQuestComposer({ store, mode = 'create', questId = null }) {
  storeRef = store ?? storeRef;
  if (!refs.composer) refs.composer = $('#composerSlot');
  if (!refs.composer) return;

  const existing = mode === 'edit'
    ? (storeRef.get('quests') ?? []).find(q => q.id === questId)
    : null;

  const draft = {
    title: existing?.title ?? '',
    description: existing?.description ?? '',
    icon: existing?.icon ?? '📜',
    topic: existing?.topic ?? 'general',
    milestones: existing
      ? (existing.milestones ?? []).map(m => ({ ...m }))
      : [
          { id: uid('m'), points: 25, title: 'First steps',   reward: '' },
          { id: uid('m'), points: 50, title: 'Halfway there', reward: '' },
          { id: uid('m'), points: 75, title: 'Almost done',   reward: '' },
        ],
  };

  const title = mode === 'edit' ? 'Edit the quest' : 'Forge a new quest';
  const cta   = mode === 'edit' ? 'Save changes'  : 'Create quest';

  refs.composer.innerHTML = `
    <form class="composer" id="questForm" novalidate>
      <div class="composer__head">
        <div>
          <h3 class="composer__title">
            <svg width="18" height="18"><use href="#i-sparkle"/></svg>
            ${title}
          </h3>
          <p class="composer__sub">Name the undertaking, pick an icon, set rewarding milestones.</p>
        </div>
        <button type="button" class="icon-btn" data-composer-close aria-label="Close">
          <svg width="16" height="16"><use href="#i-close"/></svg>
        </button>
      </div>

      <div class="composer__body">
        <label class="field">
          <span class="field__label">Quest name</span>
          <input class="field__input" name="title" type="text" required
                 placeholder="e.g. Read 12 books this year"
                 value="${escapeAttr(draft.title)}" />
          <span class="field__hint">Be specific: a clear goal is half the battle.</span>
        </label>

        <label class="field">
          <span class="field__label">Description <em style="font-style:normal; color:var(--text-dim); font-weight:500;">(optional)</em></span>
          <textarea class="field__textarea" name="description" rows="2"
                    placeholder="Why this goal? What's the payoff?">${escapeHtml(draft.description)}</textarea>
        </label>

        <div class="field-row field-row--2-1">
          <div class="field">
            <span class="field__label">Icon</span>
            <div class="icon-picker" id="iconPicker">
              ${ICON_CHOICES.map(ic => `
                <button type="button" class="icon-picker__btn" data-icon="${escapeAttr(ic)}" aria-pressed="${ic === draft.icon}">${ic}</button>
              `).join('')}
            </div>
          </div>
          <label class="field">
            <span class="field__label">Theme</span>
            <select class="field__select" name="topic">
              ${TOPIC_CHOICES.map(t => `
                <option value="${t.value}" ${t.value === draft.topic ? 'selected' : ''}>${t.label}</option>
              `).join('')}
            </select>
          </label>
        </div>

        <div class="field">
          <span class="field__label">Milestones / Chests</span>
          <span class="field__hint">Each milestone is worth 1–99 points and unlocks a reward. At 100 the quest is complete.</span>

          <div id="milestoneEditor" style="margin-top:10px;"></div>

          <button type="button" class="btn btn--ghost btn--sm" id="addMilestoneBtn" style="margin-top:10px; align-self:flex-start;">
            <svg width="14" height="14"><use href="#i-plus"/></svg>
            Add milestone
          </button>
        </div>
      </div>

      <div class="composer__foot">
        <button type="button" class="btn btn--ghost" data-composer-close>Cancel</button>
        <button type="submit" class="btn btn--primary">
          <svg width="14" height="14"><use href="#i-check"/></svg>
          ${cta}
        </button>
      </div>
    </form>
  `;

  const form       = refs.composer.querySelector('#questForm');
  const iconPicker = refs.composer.querySelector('#iconPicker');
  const msEditor   = refs.composer.querySelector('#milestoneEditor');
  const addBtn     = refs.composer.querySelector('#addMilestoneBtn');

  // Close handlers
  refs.composer.querySelectorAll('[data-composer-close]').forEach(b => {
    b.addEventListener('click', closeComposer);
  });

  // Icon picker
  iconPicker.addEventListener('click', (e) => {
    const btn = e.target.closest('.icon-picker__btn');
    if (!btn) return;
    draft.icon = btn.dataset.icon;
    iconPicker.querySelectorAll('.icon-picker__btn').forEach(b =>
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false')
    );
  });

  function renderMilestones() {
    msEditor.innerHTML = draft.milestones.length
      ? draft.milestones.map((m, idx) => `
        <div class="milestone-editor" data-idx="${idx}">
          <input class="milestone-editor__pts field__input" type="number" min="1" max="99" step="1"
                 value="${clamp(Number(m.points) || 1, 1, 99)}" aria-label="Milestone points" />
          <div class="milestone-editor__stack">
            <input class="milestone-editor__title field__input" type="text" placeholder="Milestone name"
                   value="${escapeAttr(m.title || '')}" aria-label="Milestone name" />
            <input class="milestone-editor__reward field__input" type="text"
                   placeholder="🎁 Reward (e.g. new book, dinner out, hour of relax)"
                   value="${escapeAttr(m.reward || '')}" aria-label="Reward" />
          </div>
          <button type="button" class="milestone-editor__remove" aria-label="Remove milestone">
            <svg width="16" height="16"><use href="#i-trash"/></svg>
          </button>
        </div>
      `).join('')
      : `<p style="color:var(--text-dim); font-size:.88rem; margin:0;">No milestones yet. Add one to make the quest rewarding.</p>`;
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
    const used = new Set(draft.milestones.map(m => m.points));
    let suggestion = 10;
    while (used.has(suggestion) && suggestion < 99) suggestion += 10;
    draft.milestones.push({ id: uid('m'), points: suggestion, title: '', reward: '' });
    renderMilestones();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const titleVal = form.elements.title.value.trim();
    if (!titleVal) {
      form.elements.title.focus();
      return;
    }
    const description = form.elements.description.value.trim();
    const topic = form.elements.topic.value;

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
        title: titleVal, description, topic, icon: draft.icon,
        milestones: cleanMilestones,
      });
    } else {
      addQuest(storeRef, {
        id: uid('q'),
        title: titleVal, description, topic, icon: draft.icon,
        createdAt: new Date().toISOString(),
        completedAt: null,
        milestones: cleanMilestones,
      });
    }

    closeComposer();
  });

  // Focus first input + scroll composer into view
  requestAnimationFrame(() => {
    refs.composer.querySelector('input[name="title"]')?.focus({ preventScroll: true });
    refs.composer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
