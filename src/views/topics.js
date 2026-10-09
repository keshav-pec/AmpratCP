import { h, svg, srOnly, externalLink, plural } from '../ui.js';
import { WEEKS, STEPS, TOPICS, TOPIC_BY_ID, BOOK_PATH, BOOK_PAGE_OFFSET, topicsForWeek } from '../data.js';
import { csesUrl, codeforcesUrl } from '../practice.js';
import { stepsDone, isTopicDone, toggleStep, setNotes, topicMatches } from '../store.js';

const NOTES_DELAY = 400;
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Not finished' },
  { id: 'done', label: 'Finished' },
];

function tick() {
  return svg('svg', { class: 'chip-tick', viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' },
    svg('path', { d: 'M3.5 8.5 L6.5 11.5 L12.5 5' }));
}

function referenceName(url) {
  if (url.includes('usaco.guide')) return 'USACO Guide';
  if (url.includes('cp-algorithms.com')) return 'CP-Algorithms';
  return 'reference';
}

function topicLinks(topic) {
  const links = [];
  if (topic.page) {
    links.push(externalLink(`${BOOK_PATH}#page=${topic.page + BOOK_PAGE_OFFSET}`, `Handbook p. ${topic.page}`));
  }
  if (topic.visualize) {
    links.push(externalLink(topic.visualize, 'Visualize on VisuAlgo'));
  } else {
    const q = encodeURIComponent(`${topic.title} algorithm visualization`).replace(/%20/g, '+');
    links.push(externalLink(`https://www.youtube.com/results?search_query=${q}`, 'Visualize: search YouTube'));
  }
  if (topic.reference) {
    links.push(externalLink(topic.reference, `Reference: ${referenceName(topic.reference)}`));
  }
  return h('ul', { class: 'topic-links' }, links.map((a) => h('li', null, a)));
}

function practiceRow(site, topic, problems, toUrl) {
  return h('div', { class: 'practice-row' },
    h('span', { class: 'practice-site', 'aria-hidden': 'true' }, site),
    h('ul', { class: 'practice-list', 'aria-label': `${site} practice problems for ${topic.title}` },
      problems.map(([id, name]) => h('li', null,
        externalLink(toUrl(id), h('span', { class: 'pid' }, String(id)), ' ', name)))),
  );
}

function practiceProblems(topic) {
  return h('div', { class: 'practice' },
    practiceRow('CSES', topic, topic.practice.cses, csesUrl),
    practiceRow('Codeforces', topic, topic.practice.cf, codeforcesUrl),
  );
}

function countText(state, topicId) {
  return `${stepsDone(state, topicId)} of ${STEPS.length}`;
}

function topicRow(topic, state) {
  const progress = state.topics[topic.id] || {};
  const notesId = `notes-${topic.id}`;
  const textarea = h('textarea', {
    id: notesId, name: notesId, rows: '5', spellcheck: 'false', dataset: { topic: topic.id },
  });
  textarea.value = progress.notes || '';

  return h('li', { class: `card topic${isTopicDone(state, topic.id) ? ' is-done' : ''}`, id: `topic-${topic.id}`, dataset: { topic: topic.id } },
    h('div', { class: 'topic-head' },
      h('span', { class: 'chapter', title: topic.chapter ? `Chapter ${topic.chapter}` : 'Not in the book' },
        topic.chapter ? [srOnly('Chapter '), String(topic.chapter)] : ['+', srOnly(' (not in the book)')]),
      h('h3', { class: 'topic-title', tabindex: '-1' }, topic.title),
      h('span', { class: 'topic-badges' },
        h('span', { class: `badge badge-${topic.priority.toLowerCase()}` }, topic.priority),
        topic.optional ? h('span', { class: 'badge badge-optional' }, 'Optional') : null),
      h('span', { class: 'topic-count' }, h('span', { class: 'js-count' }, countText(state, topic.id)), srOnly(' steps done')),
    ),
    h('p', { class: 'topic-focus' }, topic.focus),
    h('div', { class: 'chips', role: 'group', 'aria-label': `Steps for ${topic.title}` },
      STEPS.map((step) => h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(Boolean(progress[step.key])), dataset: { step: step.key },
      }, tick(), step.label)),
    ),
    topicLinks(topic),
    practiceProblems(topic),
    h('details', { class: 'notes', open: Boolean(progress.notes) },
      h('summary', null, 'Notes'),
      h('label', { for: notesId }, `Your notes on ${topic.title}`),
      textarea,
      h('p', { class: 'muted small' }, 'Saves automatically as you type.'),
    ),
  );
}

function weekSection(week, state) {
  const topics = topicsForWeek(week.n);
  const headingId = `topics-week-${week.n}`;
  return h('section', { class: 'topic-week', 'aria-labelledby': headingId, dataset: { week: String(week.n) } },
    h('div', { class: 'section-head' },
      h('h2', { id: headingId }, `Week ${week.n}: ${week.title}`),
      h('p', { class: 'muted js-week-count' }, weekCountText(week.n, state))),
    h('ul', { class: 'topic-list' }, topics.map((t) => topicRow(t, state))),
  );
}

function weekCountText(n, state) {
  const topics = topicsForWeek(n);
  const done = topics.reduce((sum, t) => sum + stepsDone(state, t.id), 0);
  return `${done} of ${topics.length * STEPS.length} steps`;
}

export function mount(container, { store, params, restore }) {
  const state = store.get();
  // After a re-draw, the same filter and the same open notes come back.
  const filter = { show: restore ? restore.show : 'all', query: '' };
  const pendingNotes = new Map();

  const filterButtons = FILTERS.map((f) => h('button', {
    type: 'button', class: 'chip chip-filter', 'aria-pressed': String(f.id === filter.show), dataset: { filter: f.id },
  }, f.label));
  const search = h('input', { type: 'search', id: 'topic-search', name: 'topic-search', autocomplete: 'off' });
  const status = h('p', { class: 'muted', id: 'topic-status', 'aria-live': 'polite' });
  const empty = h('p', { class: 'empty', hidden: true }, 'No topics match. Try another filter or search.');
  const weeksWithTopics = WEEKS.filter((w) => topicsForWeek(w.n).length);
  const sections = h('div', { class: 'topic-weeks' }, weeksWithTopics.map((w) => weekSection(w, state)));

  container.append(
    h('header', { class: 'page-head' },
      h('h1', { tabindex: '-1' }, 'Topics'),
      h('p', { class: 'lede' }, `${TOPICS.length} topics in plan order. For each one: read, visualize, code from memory, practise, revise. Optional topics can wait until the core ones feel solid.`),
    ),
    h('div', { class: 'filters card' },
      h('div', { class: 'field field-show' },
        h('span', { class: 'field-label', id: 'topic-show-label' }, 'Show'),
        h('div', { class: 'filter-group', role: 'group', 'aria-labelledby': 'topic-show-label' }, filterButtons)),
      h('div', { class: 'field field-search' }, h('label', { for: 'topic-search' }, 'Search topics'), search),
    ),
    status,
    sections,
    empty,
  );

  function applyFilter() {
    let shown = 0;
    for (const section of sections.children) {
      let visible = 0;
      for (const row of section.querySelectorAll('.topic')) {
        const match = topicMatches(store.get(), TOPIC_BY_ID[row.dataset.topic], filter);
        row.hidden = !match;
        if (match) visible += 1;
      }
      section.hidden = visible === 0;
      shown += visible;
    }
    empty.hidden = shown !== 0;
    status.textContent = shown === TOPICS.length ? `Showing all ${TOPICS.length} topics` : `Showing ${plural(shown, 'topic')} of ${TOPICS.length}`;
  }

  function refreshRow(topicId) {
    const s = store.get();
    const row = sections.querySelector(`#topic-${topicId}`);
    row.querySelector('.js-count').textContent = countText(s, topicId);
    row.classList.toggle('is-done', isTopicDone(s, topicId));
    const section = row.closest('.topic-week');
    section.querySelector('.js-week-count').textContent = weekCountText(Number(section.dataset.week), s);
  }

  function saveNotes(topicId) {
    const timer = pendingNotes.get(topicId);
    if (timer === undefined) return;
    clearTimeout(timer);
    pendingNotes.delete(topicId);
    const textarea = document.getElementById(`notes-${topicId}`);
    if (textarea) store.commit(setNotes(store.get(), topicId, textarea.value));
  }

  function flush() {
    for (const topicId of [...pendingNotes.keys()]) saveNotes(topicId);
  }

  function onClick(event) {
    const chip = event.target.closest('button.chip');
    if (!chip) return;
    if (chip.dataset.filter) {
      filter.show = chip.dataset.filter;
      for (const b of filterButtons) b.setAttribute('aria-pressed', String(b === chip));
      applyFilter();
      return;
    }
    const row = chip.closest('.topic');
    const topicId = row.dataset.topic;
    store.commit(toggleStep(store.get(), topicId, chip.dataset.step));
    chip.setAttribute('aria-pressed', String(Boolean(store.get().topics[topicId][chip.dataset.step])));
    // The filter isn't re-applied here, so a row doesn't vanish from under the pointer.
    refreshRow(topicId);
  }

  function onInput(event) {
    if (event.target === search) {
      filter.query = search.value;
      applyFilter();
      return;
    }
    const topicId = event.target.dataset && event.target.dataset.topic;
    if (!topicId || event.target.tagName !== 'TEXTAREA') return;
    clearTimeout(pendingNotes.get(topicId));
    pendingNotes.set(topicId, setTimeout(() => saveNotes(topicId), NOTES_DELAY));
  }

  function onFocusOut(event) {
    if (event.target.tagName === 'TEXTAREA' && event.target.dataset.topic) saveNotes(event.target.dataset.topic);
  }

  container.addEventListener('click', onClick);
  container.addEventListener('input', onInput);
  container.addEventListener('focusout', onFocusOut);

  if (restore) {
    for (const details of sections.querySelectorAll('.notes')) {
      details.open = restore.openNotes.includes(details.closest('.topic').dataset.topic);
    }
  }
  applyFilter();

  const target = params.get('topic');
  if (target && TOPIC_BY_ID[target]) {
    const row = sections.querySelector(`#topic-${target}`);
    row.classList.add('is-target');
    row.querySelector('.topic-title').setAttribute('data-autofocus', '');
  }

  return {
    flush,
    snapshot() {
      const open = [...sections.querySelectorAll('.notes[open]')].map((d) => d.closest('.topic').dataset.topic);
      return { show: filter.show, openNotes: open };
    },
    unmount() {
      flush();
      container.removeEventListener('click', onClick);
      container.removeEventListener('input', onInput);
      container.removeEventListener('focusout', onFocusOut);
    },
  };
}
