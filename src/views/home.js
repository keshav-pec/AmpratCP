import { h, svg, srOnly, progressBar } from '../ui.js';
import { WEEKS, WEEK_BY_NUMBER, TOTAL_STEPS, STEPS, TOPICS } from '../data.js';
import {
  totalStepsDone, weekFill, weekStatus, weekChecklist, currentWeek, nextTopic, stepsDone,
  revisitCount, STATUS_LABELS,
} from '../store.js';

// Balloon body from the bottom tip, round at the top. Spans y = 2..38.
const BODY = 'M20 38 C11 33 4 26 4 17 C4 8.2 11.2 2 20 2 C28.8 2 36 8.2 36 17 C36 26 29 33 20 38 Z';
const BODY_TOP = 2;
const BODY_BOTTOM = 38;

function balloonSvg(n, fill) {
  const clipId = `balloon-clip-${n}`;
  const fillHeight = (BODY_BOTTOM - BODY_TOP) * fill;
  return svg('svg', { class: 'balloon-svg', viewBox: '0 0 40 58', 'aria-hidden': 'true', focusable: 'false' },
    svg('defs', null, svg('clipPath', { id: clipId }, svg('path', { d: BODY }))),
    svg('rect', {
      class: 'balloon-fill', x: '0', y: String(BODY_BOTTOM - fillHeight), width: '40', height: String(fillHeight),
      'clip-path': `url(#${clipId})`,
    }),
    svg('path', { class: 'balloon-outline', d: BODY }),
    svg('path', { class: 'balloon-knot', d: 'M20 38 L17.5 41.5 L22.5 41.5 Z' }),
    svg('path', { class: 'balloon-string', d: 'M20 41.5 C17 46 23 51 20 57' }),
  );
}

function balloonStrip(state, current) {
  return h('ol', { class: 'balloons' },
    WEEKS.map((w) => {
      const status = STATUS_LABELS[weekStatus(state, w.n)].toLowerCase();
      const isCurrent = w.n === current;
      return h('li', null,
        h('a', { class: `balloon${isCurrent ? ' is-current' : ''}`, href: `#/plan?week=${w.n}` },
          balloonSvg(w.n, weekFill(state, w.n)),
          h('span', { class: 'balloon-label' }, srOnly('Week '), String(w.n)),
          srOnly(`: ${w.title}, ${status}${isCurrent ? ', current week' : ''}`),
        ),
      );
    }),
  );
}

function itemText(item) {
  if (!item.derived) return item.label;
  return `${item.label} (${item.progress.done} of ${item.progress.total} steps)`;
}

function currentWeekCard(state, n) {
  const card = h('section', { class: 'card', 'aria-labelledby': 'home-current-title' },
    h('h2', { id: 'home-current-title', class: 'card-label' }, 'Current week'));
  if (n === null) {
    card.append(
      h('p', null, 'All 8 weeks are done. Keep re-solving problems and doing virtual contests.'),
      h('a', { class: 'btn', href: '#/plan' }, 'Open plan'),
    );
    return card;
  }
  const week = WEEK_BY_NUMBER[n];
  const remaining = weekChecklist(state, n).filter((i) => !i.done);
  card.append(
    h('p', { class: 'card-title' }, `Week ${n}: ${week.title}`),
    h('p', { class: 'muted' }, 'Still to do:'),
    h('ul', { class: 'todo-list' }, remaining.map((i) => h('li', null, itemText(i)))),
    h('div', { class: 'card-actions' }, h('a', { class: 'btn btn-primary', href: `#/plan?week=${n}` }, 'Open week')),
  );
  return card;
}

function continueCard(state) {
  const card = h('section', { class: 'card', 'aria-labelledby': 'home-continue-title' },
    h('h2', { id: 'home-continue-title', class: 'card-label' }, 'Continue learning'));
  const next = nextTopic(state);
  if (!next) {
    card.append(h('p', null, `Every topic has ${STEPS.length} of ${STEPS.length} steps. Well done.`));
    return card;
  }
  const { topic, step } = next;
  const where = topic.chapter ? `Chapter ${topic.chapter}` : 'Not in the book';
  card.append(
    h('p', { class: 'card-title' }, topic.title),
    h('p', { class: 'muted' }, `Week ${topic.week} · ${where} · ${stepsDone(state, topic.id)} of ${STEPS.length} steps`),
    h('p', null, 'Next step: ', h('strong', null, step.label)),
    h('div', { class: 'card-actions' }, h('a', { class: 'btn', href: `#/topics?topic=${topic.id}` }, 'Go to topic')),
  );
  return card;
}

function statCard(href, count, label) {
  return h('a', { class: 'stat card', href },
    h('span', { class: 'stat-number' }, String(count)),
    h('span', { class: 'stat-label' }, label));
}

export function mount(container, { store }) {
  const state = store.get();
  const done = totalStepsDone(state);
  const current = currentWeek(state);
  const fresh = done === 0 && state.problems.length === 0 && Object.keys(state.weekChecks).length === 0;
  const revisit = revisitCount(state);
  const logged = state.problems.length;

  container.append(
    h('header', { class: 'page-head' },
      h('h1', { tabindex: '-1' }, fresh ? 'Welcome to Balloon Room' : 'Welcome back'),
      h('p', { class: 'lede' }, fresh
        ? `${TOPICS.length} topics across 8 weeks. Start with Week 1 whenever you're ready.`
        : 'Pick up wherever you left off. There is no schedule to keep up with.'),
    ),

    h('section', { class: 'card', 'aria-labelledby': 'home-progress-title' },
      h('h2', { id: 'home-progress-title', class: 'sr-only' }, 'Overall progress'),
      h('p', { class: 'progress-line' }, h('strong', null, String(done)), ` of ${TOTAL_STEPS} topic steps done`),
      progressBar(done / TOTAL_STEPS),
      balloonStrip(state, current),
      h('p', { class: 'muted small' }, 'Each balloon is a week. It fills as that week’s checklist gets done.'),
    ),

    h('div', { class: 'grid-2' }, currentWeekCard(state, current), continueCard(state)),

    h('div', { class: 'grid-2' },
      statCard('#/problems?show=revisit', revisit, `${revisit === 1 ? 'problem' : 'problems'} marked to revisit`),
      statCard('#/problems', logged, `${logged === 1 ? 'problem' : 'problems'} logged`),
    ),
  );
}
