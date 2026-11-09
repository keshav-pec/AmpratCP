import { h, svg, srOnly, externalLink, plural } from '../ui.js';
import { WEEKS, STEPS, TOPICS, TOPIC_BY_ID, topicsForWeek, handbookUrl } from '../data.js';
import { csesUrl, codeforcesUrl } from '../practice.js';
import { LEVELS, csesDifficulty, cfDifficulty } from '../difficulty.js';
import { stepsDone, isTopicDone, toggleStep, setNotes, topicMatches, practiceMatches } from '../store.js';

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

function chevron() {
  return svg('svg', { class: 'chevron', viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' },
    svg('path', { d: 'M4 6 L8 10 L12 6' }));
}

function referenceName(url) {
  if (url.includes('usaco.guide')) return 'USACO Guide';
  if (url.includes('cp-algorithms.com')) return 'CP-Algorithms';
  return 'reference';
}

function topicLinks(topic) {
  const links = [];
  if (topic.page) {
    links.push(externalLink(handbookUrl(topic.page), `Handbook: chapter ${topic.chapter}, p. ${topic.page}`));
  }
  if (topic.reference) {
    links.push(externalLink(topic.reference, `Reference: ${referenceName(topic.reference)}`));
  }
  return links.length ? h('ul', { class: 'topic-links' }, links.map((a) => h('li', null, a))) : null;
}

function playIcon() {
  return svg('svg', { class: 'play-icon', viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' },
    svg('path', { d: 'M5 3.5 L12.5 8 L5 12.5 Z' }));
}

function visualRow(name, topic, visuals) {
  if (!visuals.length) return null;
  return h('div', { class: 'link-row' },
    h('span', { class: 'link-row-label', 'aria-hidden': 'true' }, name),
    h('ul', { class: 'link-row-list', 'aria-label': `${name} for ${topic.title}` },
      visuals.map((v) => h('li', null, v.video
        ? externalLink(v.url, playIcon(), v.label)
        : externalLink(v.url, v.label)))),
  );
}

// Interactive pages in one row, videos (marked with a play icon) in the next.
function visualsList(topic) {
  if (!topic.visuals.length) return null;
  const pages = topic.visuals.filter((v) => !v.video);
  const videos = topic.visuals.filter((v) => v.video);
  const counts = [pages.length && `${pages.length} interactive`, videos.length && plural(videos.length, 'video')]
    .filter(Boolean).join(' · ');
  return h('details', { class: 'fold visuals' },
    h('summary', null, 'Visualize', h('span', { class: 'summary-count' }, ` ${counts}`)),
    h('div', { class: 'fold-body' },
      visualRow('Interactive', topic, pages),
      visualRow('Videos', topic, videos)),
  );
}

// A problem link as a pill, its background colored by difficulty.
function problemPill(url, id, name, difficulty) {
  const { level, detail } = difficulty;
  return h('a', {
    class: `pill pill-${level.key}`, href: url, target: '_blank', rel: 'noopener noreferrer', title: `${level.label}: ${detail}`,
  },
  h('span', { class: 'pid' }, String(id)), ' ', name,
  srOnly(` (${level.label}, ${detail}; opens in a new tab)`));
}

function practiceRow(site, topic, problems, toUrl, toDifficulty) {
  return h('div', { class: 'link-row' },
    h('span', { class: 'link-row-label', 'aria-hidden': 'true' }, site),
    h('ul', { class: 'link-row-list pill-list', 'aria-label': `${site} practice problems for ${topic.title}` },
      problems.map(([id, name]) => h('li', null, problemPill(toUrl(id), id, name, toDifficulty(id))))),
  );
}

function difficultyLegend() {
  return h('div', { class: 'legend' },
    h('span', { class: 'legend-label', id: 'difficulty-legend' }, 'Problem difficulty'),
    h('ul', { class: 'pill-list', 'aria-labelledby': 'difficulty-legend' },
      LEVELS.map((level) => h('li', null, h('span', {
        class: `pill pill-${level.key}`, title: `CSES: ${level.cses}. Codeforces: ${level.cf}.`,
      }, level.label)))),
    h('p', { class: 'muted small legend-note' }, 'CSES problems are graded by how many people solved them, Codeforces problems by their rating. Hover a problem for its numbers.'),
  );
}

function practiceProblems(topic) {
  const { cses, cf } = topic.practice;
  return h('details', { class: 'fold practice' },
    h('summary', null, 'Practice problems',
      h('span', { class: 'summary-count' }, ` ${cses.length} CSES · ${cf.length} Codeforces`)),
    h('div', { class: 'fold-body' },
      practiceRow('CSES', topic, cses, csesUrl, csesDifficulty),
      practiceRow('Codeforces', topic, cf, codeforcesUrl, cfDifficulty)),
  );
}

function countText(state, topicId) {
  return `${stepsDone(state, topicId)} of ${STEPS.length}`;
}

// Each topic is a card that opens and closes like the weekly plan cards. Closed, it shows the
// title, what to focus on, and progress; open, the steps, links, practice and notes.
function topicRow(topic, state) {
  const progress = state.topics[topic.id] || {};
  const notesId = `notes-${topic.id}`;
  const bodyId = `topic-${topic.id}-body`;
  const textarea = h('textarea', {
    id: notesId, name: notesId, rows: '5', spellcheck: 'false', dataset: { topic: topic.id },
  });
  textarea.value = progress.notes || '';

  const toggle = h('button', {
    type: 'button', class: 'topic-toggle', 'aria-expanded': 'false', 'aria-controls': bodyId,
  },
  h('span', { class: 'topic-num' }, srOnly('Topic '), String(topic.number)),
  h('span', { class: 'topic-heading' },
    h('span', { class: 'topic-name' }, topic.title),
    h('span', { class: 'topic-focus' }, topic.focus)),
  h('span', { class: 'topic-meta' },
    h('span', { class: `badge badge-${topic.priority.toLowerCase()}` }, topic.priority),
    topic.optional ? h('span', { class: 'badge badge-optional' }, 'Optional') : null,
    h('span', { class: 'topic-chapter' }, topic.chapter ? `Chapter ${topic.chapter}` : 'Not in the book'),
    h('span', { class: 'topic-count' }, h('span', { class: 'js-count' }, countText(state, topic.id)), srOnly(' steps done'))),
  chevron());

  return h('li', { class: `card topic${isTopicDone(state, topic.id) ? ' is-done' : ''}`, id: `topic-${topic.id}`, dataset: { topic: topic.id } },
    h('h3', { class: 'topic-title' }, toggle),
    h('div', { class: 'topic-body', id: bodyId, hidden: true },
      h('div', { class: 'chips', role: 'group', 'aria-label': `Steps for ${topic.title}` },
        STEPS.map((step) => h('button', {
          type: 'button', class: 'chip', 'aria-pressed': String(Boolean(progress[step.key])), dataset: { step: step.key },
        }, tick(), step.label)),
      ),
      topicLinks(topic),
      visualsList(topic),
      practiceProblems(topic),
      h('details', { class: 'notes' },
        h('summary', null, 'Notes'),
        h('label', { for: notesId }, `Your notes on ${topic.title}`),
        textarea,
        h('p', { class: 'muted small' }, 'Saves automatically as you type.'),
      )),
  );
}

function setExpanded(row, expanded) {
  row.querySelector('.topic-toggle').setAttribute('aria-expanded', String(expanded));
  row.querySelector('.topic-body').hidden = !expanded;
}

function isExpanded(row) {
  return row.querySelector('.topic-toggle').getAttribute('aria-expanded') === 'true';
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
  // After a re-draw, the same filter, the same open cards and the same open notes come back.
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
      h('p', { class: 'lede' }, `${TOPICS.length} topics in plan order. For each one: read and visualize it, then code it from memory and solve its practice problems. Problems that gave you trouble go in the problem log for revision. Optional topics can wait until the core ones feel solid.`),
      difficultyLegend(),
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
        const topic = TOPIC_BY_ID[row.dataset.topic];
        const match = topicMatches(store.get(), topic, filter);
        row.hidden = !match;
        showMatchingProblems(row, match && practiceMatches(topic, filter.query));
        if (match) visible += 1;
      }
      section.hidden = visible === 0;
      shown += visible;
    }
    empty.hidden = shown !== 0;
    status.textContent = shown === TOPICS.length ? `Showing all ${TOPICS.length} topics` : `Showing ${plural(shown, 'topic')} of ${TOPICS.length}`;
  }

  // A search that matches a problem opens that topic's card and practice list, and closes each
  // again once the search no longer matches, unless it was open already.
  function showMatchingProblems(row, matches) {
    const details = row.querySelector('.practice');
    if (matches) {
      if (!isExpanded(row)) {
        setExpanded(row, true);
        row.dataset.searchOpened = '';
      }
      if (!details.open) {
        details.open = true;
        details.dataset.searchOpened = '';
      }
      return;
    }
    if ('searchOpened' in row.dataset) {
      setExpanded(row, false);
      delete row.dataset.searchOpened;
    }
    if ('searchOpened' in details.dataset) {
      details.open = false;
      delete details.dataset.searchOpened;
    }
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
    const toggle = event.target.closest('.topic-toggle');
    if (toggle) {
      const row = toggle.closest('.topic');
      setExpanded(row, !isExpanded(row));
      // Opened or closed by hand now, so a search shouldn't close it later.
      delete row.dataset.searchOpened;
      return;
    }
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
    for (const row of sections.querySelectorAll('.topic')) {
      setExpanded(row, restore.openTopics.includes(row.dataset.topic));
    }
    for (const details of sections.querySelectorAll('.notes')) {
      details.open = restore.openNotes.includes(details.closest('.topic').dataset.topic);
    }
    for (const details of sections.querySelectorAll('.practice')) {
      details.open = restore.openPractice.includes(details.closest('.topic').dataset.topic);
    }
    for (const details of sections.querySelectorAll('.visuals')) {
      details.open = restore.openVisuals.includes(details.closest('.topic').dataset.topic);
    }
  }
  applyFilter();

  const target = params.get('topic');
  if (target && TOPIC_BY_ID[target]) {
    const row = sections.querySelector(`#topic-${target}`);
    row.classList.add('is-target');
    // On a re-draw the card keeps whatever state the reader left it in.
    if (!restore) setExpanded(row, true);
    row.querySelector('.topic-toggle').setAttribute('data-autofocus', '');
  }

  return {
    flush,
    snapshot() {
      const openIn = (selector) => [...sections.querySelectorAll(`${selector}[open]`)].map((d) => d.closest('.topic').dataset.topic);
      const openTopics = [...sections.querySelectorAll('.topic-toggle[aria-expanded="true"]')].map((t) => t.closest('.topic').dataset.topic);
      return { show: filter.show, openTopics, openNotes: openIn('.notes'), openPractice: openIn('.practice'), openVisuals: openIn('.visuals') };
    },
    unmount() {
      flush();
      container.removeEventListener('click', onClick);
      container.removeEventListener('input', onInput);
      container.removeEventListener('focusout', onFocusOut);
    },
  };
}
