import { h, svg, srOnly, externalLink, plural } from '../ui.js';
import { WEEKS, STEPS, topicsForWeek } from '../data.js';
import {
  weekChecklist, weekStatus, currentWeek, stepsDone, revisitCount, setWeekCheck, weekPracticeCounts, STATUS_LABELS,
} from '../store.js';

function chevron() {
  return svg('svg', { class: 'chevron', viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' },
    svg('path', { d: 'M4 6 L8 10 L12 6' }));
}

function checkIcon(done) {
  return svg('svg', { class: `check-icon${done ? ' is-done' : ''}`, viewBox: '0 0 20 20', 'aria-hidden': 'true', focusable: 'false' },
    svg('circle', { cx: '10', cy: '10', r: '8.5' }),
    done ? svg('path', { d: 'M6 10.5 L8.8 13 L14 7.5' }) : null);
}

function statusBadge(status) {
  return h('span', { class: `status status-${status}` }, STATUS_LABELS[status]);
}

function hintFor(item, state, week) {
  if (item.hint === 'practice') {
    const { cses, cf } = weekPracticeCounts(week.n);
    const first = topicsForWeek(week.n)[0];
    return h('a', { class: 'check-hint', href: `#/topics?topic=${first.id}` },
      `${cses} CSES and ${cf} Codeforces problems, listed under each topic`);
  }
  if (item.hint === 'revisit') {
    const n = revisitCount(state);
    return h('a', { class: 'check-hint', href: '#/problems?show=revisit' },
      n ? `${plural(n, 'problem')} marked to revisit` : 'Nothing marked to revisit right now');
  }
  if (item.hint === 'patterns') {
    return h('a', { class: 'check-hint', href: '#/problems' }, 'See mistake patterns in the problem log');
  }
  return null;
}

function derivedItem(item) {
  const { done, total } = item.progress;
  return h('li', { class: 'check check-derived', dataset: { item: item.id } },
    checkIcon(item.done),
    h('div', { class: 'check-text' },
      h('span', null, item.label),
      srOnly(item.done ? ' (done)' : ' (not done yet)'),
      h('span', { class: 'check-hint muted' }, `${done} of ${total} steps. This ticks itself when every topic has ${STEPS.length} of ${STEPS.length} steps.`),
    ),
  );
}

function manualItem(week, item, state) {
  const id = `week-${week.n}-${item.id}`;
  return h('li', { class: 'check' },
    h('input', { type: 'checkbox', id, name: id, checked: item.done, dataset: { week: String(week.n), item: item.id } }),
    h('div', { class: 'check-text' },
      h('label', { for: id }, item.label),
      item.link ? externalLink(item.link.url, item.link.label) : null,
      hintFor(item, state, week),
    ),
  );
}

function weekCard(week, state, expanded) {
  const status = weekStatus(state, week.n);
  const bodyId = `week-${week.n}-body`;
  const topics = topicsForWeek(week.n);
  const items = weekChecklist(state, week.n);

  const toggle = h('button', {
    type: 'button', class: 'week-toggle', 'aria-expanded': String(expanded), 'aria-controls': bodyId,
  },
  h('span', { class: 'week-heading' },
    h('span', { class: 'week-name' }, `Week ${week.n}: ${week.title}`),
    h('span', { class: 'week-summary' }, week.summary)),
  statusBadge(status),
  chevron());

  const topicList = topics.length
    ? h('ul', { class: 'week-topics' }, topics.map((t) => h('li', null,
      h('a', { href: `#/topics?topic=${t.id}` }, t.title),
      h('span', { class: 'muted' }, ` ${t.chapter ? `Ch. ${t.chapter}` : 'Not in the book'} · ${stepsDone(state, t.id)} of ${STEPS.length}${t.optional ? ' · optional' : ''}`),
    )))
    : h('p', { class: 'muted' }, 'No new topics this week.');

  const body = h('div', { class: 'week-body', id: bodyId, hidden: !expanded },
    h('h3', null, 'Topics'),
    topicList,
    week.extras.length
      ? [h('h3', null, 'Also read'), h('ul', { class: 'week-topics' }, week.extras.map((x) => h('li', null, externalLink(x.url, x.label))))]
      : null,
    h('h3', null, 'Checklist'),
    h('ul', { class: 'checklist' }, items.map((item) => (item.derived ? derivedItem(item) : manualItem(week, item, state)))),
  );

  return h('section', { class: 'card week', id: `week-${week.n}`, dataset: { week: String(week.n) } },
    h('h2', { class: 'week-title' }, toggle),
    body);
}

export function mount(container, { store, params, restore }) {
  const state = store.get();
  const requested = Number(params.get('week'));
  const target = WEEKS.some((w) => w.n === requested) ? requested : null;
  // After a re-draw, the same weeks stay open.
  const open = restore ? new Set(restore.open) : new Set([target || currentWeek(state) || 1]);

  const list = h('div', { class: 'weeks' }, WEEKS.map((w) => weekCard(w, state, open.has(w.n))));

  container.append(
    h('header', { class: 'page-head' },
      h('h1', { tabindex: '-1' }, 'Plan'),
      h('p', { class: 'lede' }, 'Eight weeks in order. Every week is open, so move on whenever you feel ready.'),
    ),
    list,
  );

  if (target) list.querySelector(`#week-${target} .week-toggle`).setAttribute('data-autofocus', '');

  function onClick(event) {
    const toggle = event.target.closest('.week-toggle');
    if (!toggle) return;
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    document.getElementById(toggle.getAttribute('aria-controls')).hidden = expanded;
  }

  function onChange(event) {
    const box = event.target;
    if (!box.matches('input[type="checkbox"][data-week]')) return;
    const n = Number(box.dataset.week);
    store.commit(setWeekCheck(store.get(), n, box.dataset.item, box.checked));
    // Only this week's status can change.
    const card = list.querySelector(`#week-${n}`);
    card.querySelector('.status').replaceWith(statusBadge(weekStatus(store.get(), n)));
  }

  list.addEventListener('click', onClick);
  list.addEventListener('change', onChange);
  return {
    snapshot() {
      const toggles = list.querySelectorAll('.week-toggle[aria-expanded="true"]');
      return { open: [...toggles].map((t) => Number(t.closest('.week').dataset.week)) };
    },
    unmount() {
      list.removeEventListener('click', onClick);
      list.removeEventListener('change', onChange);
    },
  };
}
