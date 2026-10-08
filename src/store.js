// State, pure update functions, derived values and persistence.
// Every update function returns a new state object and never mutates its input.

import {
  STEPS, TOPICS, TOPIC_BY_ID, TOTAL_STEPS, WEEKS, WEEK_BY_NUMBER, topicsForWeek,
  RESULTS, MISTAKES, DEFAULT_RESULT, DEFAULT_MISTAKE,
} from './data.js';

export const STORAGE_KEY = 'balloonroom:v1';
export const BACKUP_KEY = 'balloonroom:v1:backup';
export const SCHEMA_VERSION = 1;

const STEP_KEYS = STEPS.map((s) => s.key);
const RESULT_IDS = RESULTS.map((r) => r.id);
const MISTAKE_IDS = MISTAKES.map((m) => m.id);

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');

export const THEMES = ['system', 'light', 'dark'];
export const SIDEBAR_STATES = ['expanded', 'collapsed'];

function defaultPrefs() {
  return { theme: 'system', sidebar: 'expanded' };
}

function emptyTopic() {
  return { read: false, visual: false, code: false, practice: false, revise: false, notes: '' };
}

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    topics: Object.fromEntries(TOPICS.map((t) => [t.id, emptyTopic()])),
    weekChecks: {},
    problems: [],
    prefs: defaultPrefs(),
  };
}

// ---------- migration ----------

function normalizeTopic(raw) {
  const out = emptyTopic();
  if (!isObject(raw)) return out;
  for (const key of STEP_KEYS) out[key] = raw[key] === true;
  out.notes = str(raw.notes);
  return out;
}

function normalizeProblem(raw, index) {
  if (!isObject(raw)) return null;
  const name = str(raw.name).trim();
  if (!name) return null;
  const url = isHttpUrl(str(raw.url).trim()) ? str(raw.url).trim() : '';
  const resolved = Number.isInteger(raw.resolvedCount) && raw.resolvedCount > 0 ? raw.resolvedCount : 0;
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : 0;
  return {
    id: str(raw.id) || `p_legacy_${index}`,
    name,
    url,
    topicId: TOPIC_BY_ID[raw.topicId] ? raw.topicId : '',
    result: RESULT_IDS.includes(raw.result) ? raw.result : DEFAULT_RESULT,
    mistake: MISTAKE_IDS.includes(raw.mistake) ? raw.mistake : DEFAULT_MISTAKE,
    idea: str(raw.idea).trim(),
    revisit: raw.revisit === true,
    resolvedCount: resolved,
    createdAt,
  };
}

// Brings any stored value (empty, unversioned, partial or current) up to the current schema.
export function migrate(raw) {
  const state = defaultState();
  if (!isObject(raw)) return state;

  // Version 0 is anything saved without a `version` field. It used the same field
  // names, so the normalisation below covers it; future versions add steps here.
  // `prefs` was added later within version 1; states without it get the defaults.

  if (isObject(raw.topics)) {
    for (const [id, value] of Object.entries(raw.topics)) {
      state.topics[id] = normalizeTopic(value);
    }
  }

  if (isObject(raw.weekChecks)) {
    for (const w of WEEKS) {
      const checks = raw.weekChecks[w.n];
      if (!isObject(checks)) continue;
      const clean = {};
      for (const item of w.checklist) {
        if (!item.derived && checks[item.id] === true) clean[item.id] = true;
      }
      if (Object.keys(clean).length) state.weekChecks[w.n] = clean;
    }
  }

  if (isObject(raw.prefs)) {
    if (THEMES.includes(raw.prefs.theme)) state.prefs.theme = raw.prefs.theme;
    if (SIDEBAR_STATES.includes(raw.prefs.sidebar)) state.prefs.sidebar = raw.prefs.sidebar;
  }

  if (Array.isArray(raw.problems)) {
    const seen = new Set();
    raw.problems.forEach((p, i) => {
      const clean = normalizeProblem(p, i);
      if (!clean) return;
      if (seen.has(clean.id)) clean.id = `${clean.id}_${i}`;
      seen.add(clean.id);
      state.problems.push(clean);
    });
  }

  return state;
}

// ---------- persistence ----------

// Returns { state, status } where status is 'empty', 'ok', 'corrupt' or 'unavailable'.
export function load(storage) {
  if (!storage) return { state: defaultState(), status: 'unavailable' };
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: defaultState(), status: 'unavailable' };
  }
  if (raw === null || raw === undefined) return { state: defaultState(), status: 'empty' };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  if (!isObject(parsed)) {
    try {
      storage.setItem(BACKUP_KEY, String(raw));
    } catch {
      // Nothing else we can do; the raw value stays under the main key until the next save.
    }
    return { state: defaultState(), status: 'corrupt' };
  }
  return { state: migrate(parsed), status: 'ok' };
}

export function save(storage, state) {
  if (!storage) return { ok: false, error: 'unavailable' };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (err) {
    const quota = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
    return { ok: false, error: quota ? 'quota' : 'write' };
  }
}

// A tiny wrapper so views can read the current state and commit a new one.
export function createStore({ storage, onSave = () => {} } = {}) {
  const loaded = load(storage);
  let state = loaded.state;
  return {
    loadStatus: loaded.status,
    get: () => state,
    commit(next) {
      if (next === state) return { ok: true };
      state = next;
      const result = save(storage, state);
      onSave(result);
      return result;
    },
    // Re-reads storage after another tab saved, so this tab never writes over newer data.
    // Unreadable data is ignored and the current state kept. Returns true if state changed.
    reload() {
      const fresh = load(storage);
      if (fresh.status !== 'ok' && fresh.status !== 'empty') return false;
      if (JSON.stringify(fresh.state) === JSON.stringify(state)) return false;
      state = fresh.state;
      return true;
    },
  };
}

// ---------- topics ----------

function withTopic(state, topicId, patch) {
  if (!TOPIC_BY_ID[topicId]) return state;
  const current = state.topics[topicId] || emptyTopic();
  return { ...state, topics: { ...state.topics, [topicId]: { ...current, ...patch } } };
}

export function setStep(state, topicId, stepKey, value) {
  if (!STEP_KEYS.includes(stepKey)) return state;
  return withTopic(state, topicId, { [stepKey]: value === true });
}

export function toggleStep(state, topicId, stepKey) {
  const current = state.topics[topicId] || emptyTopic();
  return setStep(state, topicId, stepKey, !current[stepKey]);
}

export function setNotes(state, topicId, notes) {
  const current = state.topics[topicId] || emptyTopic();
  if (current.notes === notes) return state;
  return withTopic(state, topicId, { notes: str(notes) });
}

export function stepsDone(state, topicId) {
  const t = state.topics[topicId];
  if (!t) return 0;
  return STEP_KEYS.reduce((n, key) => n + (t[key] ? 1 : 0), 0);
}

export function isTopicDone(state, topicId) {
  return stepsDone(state, topicId) === STEP_KEYS.length;
}

export function totalStepsDone(state) {
  return TOPICS.reduce((n, t) => n + stepsDone(state, t.id), 0);
}

export { TOTAL_STEPS };

export function nextStep(state, topicId) {
  const t = state.topics[topicId] || emptyTopic();
  return STEPS.find((s) => !t[s.key]) || null;
}

// The next unfinished topic in plan order, with its next unfinished step.
export function nextTopic(state) {
  for (const topic of TOPICS) {
    const step = nextStep(state, topic.id);
    if (step) return { topic, step };
  }
  return null;
}

// Filter for the Topics page. `show` is 'all', 'open' (not finished) or 'done'.
export function topicMatches(state, topic, { show = 'all', query = '' } = {}) {
  const done = isTopicDone(state, topic.id);
  if (show === 'open' && done) return false;
  if (show === 'done' && !done) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const problems = [...topic.practice.cses, ...topic.practice.cf].map(([id, name]) => `${id} ${name}`);
  const haystack = [topic.title, topic.priority, topic.chapter ? `chapter ${topic.chapter}` : '', ...problems]
    .join(' ').toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

// Every CSES and Codeforces problem listed for a week's topics.
export function weekPracticeCounts(weekNumber) {
  return topicsForWeek(weekNumber).reduce(
    (acc, t) => ({ cses: acc.cses + t.practice.cses.length, cf: acc.cf + t.practice.cf.length }),
    { cses: 0, cf: 0 },
  );
}

// ---------- weeks ----------

export function setWeekCheck(state, weekNumber, checkId, value) {
  const week = WEEK_BY_NUMBER[weekNumber];
  const item = week && week.checklist.find((c) => c.id === checkId);
  if (!item || item.derived) return state;
  const checks = { ...(state.weekChecks[weekNumber] || {}) };
  if (value) checks[checkId] = true;
  else delete checks[checkId];
  const weekChecks = { ...state.weekChecks };
  if (Object.keys(checks).length) weekChecks[weekNumber] = checks;
  else delete weekChecks[weekNumber];
  return { ...state, weekChecks };
}

// Progress of the derived "finish the 5-step loop" item. Optional topics don't count towards it.
export function loopProgress(state, weekNumber) {
  const required = topicsForWeek(weekNumber).filter((t) => !t.optional);
  const total = required.length * STEP_KEYS.length;
  const done = required.reduce((n, t) => n + stepsDone(state, t.id), 0);
  return { done, total, topicsDone: required.filter((t) => isTopicDone(state, t.id)).length, topicsTotal: required.length };
}

// The week's checklist with each item's label and done flag resolved.
export function weekChecklist(state, weekNumber) {
  const week = WEEK_BY_NUMBER[weekNumber];
  if (!week) return [];
  const checks = state.weekChecks[weekNumber] || {};
  return week.checklist.map((item) => {
    if (!item.derived) return { ...item, done: checks[item.id] === true };
    const p = loopProgress(state, weekNumber);
    const hasOptional = topicsForWeek(weekNumber).some((t) => t.optional);
    return {
      ...item,
      label: hasOptional
        ? "Finish the 5-step loop for every topic that isn't optional"
        : 'Finish the 5-step loop for every topic',
      done: p.total > 0 && p.done === p.total,
      progress: p,
    };
  });
}

// 'not-started', 'in-progress' or 'done', computed from the checklist.
export function weekStatus(state, weekNumber) {
  const items = weekChecklist(state, weekNumber);
  if (items.length && items.every((i) => i.done)) return 'done';
  const anyStep = topicsForWeek(weekNumber).some((t) => stepsDone(state, t.id) > 0);
  if (items.some((i) => i.done) || anyStep) return 'in-progress';
  return 'not-started';
}

export const STATUS_LABELS = { 'not-started': 'Not started', 'in-progress': 'In progress', done: 'Done' };

// 0..1, how full the week's balloon is. The loop item counts in proportion to its steps.
export function weekFill(state, weekNumber) {
  const items = weekChecklist(state, weekNumber);
  if (!items.length) return 0;
  const sum = items.reduce((n, i) => {
    if (i.derived) return n + (i.progress.total ? i.progress.done / i.progress.total : 0);
    return n + (i.done ? 1 : 0);
  }, 0);
  return sum / items.length;
}

// The first week whose checklist isn't fully done, or null when all 8 are done.
export function currentWeek(state) {
  const week = WEEKS.find((w) => weekStatus(state, w.n) !== 'done');
  return week ? week.n : null;
}

// ---------- problems ----------

export function isHttpUrl(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    const u = new URL(value);
    return (u.protocol === 'http:' || u.protocol === 'https:') && Boolean(u.hostname);
  } catch {
    return false;
  }
}

export function defaultRevisit(result) {
  return result !== 'alone';
}

// Returns { ok, errors, value }. `value` is the cleaned input when ok.
export function validateProblem(input = {}) {
  const errors = {};
  const name = str(input.name).trim();
  const url = str(input.url).trim();
  if (!name) errors.name = 'Enter the problem name.';
  if (url && !isHttpUrl(url)) errors.url = 'Use a full link that starts with http:// or https://, or leave it empty.';
  const result = RESULT_IDS.includes(input.result) ? input.result : DEFAULT_RESULT;
  const value = {
    name,
    url,
    topicId: TOPIC_BY_ID[input.topicId] ? input.topicId : '',
    result,
    mistake: MISTAKE_IDS.includes(input.mistake) ? input.mistake : DEFAULT_MISTAKE,
    idea: str(input.idea).trim(),
    revisit: typeof input.revisit === 'boolean' ? input.revisit : defaultRevisit(result),
  };
  const ok = Object.keys(errors).length === 0;
  return { ok, errors, value: ok ? value : null };
}

export function makeId(now = Date.now()) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `p_${now.toString(36)}_${rand}`;
}

// Returns { state, problem } on success or { state (unchanged), errors } on failure.
export function addProblem(state, input, { now = Date.now(), id = makeId(now) } = {}) {
  const v = validateProblem(input);
  if (!v.ok) return { state, errors: v.errors };
  const problem = { id, ...v.value, resolvedCount: 0, createdAt: now };
  return { state: { ...state, problems: [...state.problems, problem] }, problem };
}

export function updateProblem(state, id, input) {
  const existing = state.problems.find((p) => p.id === id);
  if (!existing) return { state, errors: { form: 'That problem no longer exists.' } };
  const v = validateProblem(input);
  if (!v.ok) return { state, errors: v.errors };
  const problem = { ...existing, ...v.value };
  return { state: { ...state, problems: state.problems.map((p) => (p.id === id ? problem : p)) }, problem };
}

export function deleteProblem(state, id) {
  if (!state.problems.some((p) => p.id === id)) return state;
  return { ...state, problems: state.problems.filter((p) => p.id !== id) };
}

// "Re-solved it": clears the revisit flag and counts the re-solve.
export function markResolved(state, id) {
  if (!state.problems.some((p) => p.id === id)) return state;
  return {
    ...state,
    problems: state.problems.map((p) => (p.id === id ? { ...p, revisit: false, resolvedCount: p.resolvedCount + 1 } : p)),
  };
}

// Newest first. Ties (same createdAt) keep the later-added problem first.
export function sortedProblems(problems) {
  return problems
    .map((p, i) => [p, i])
    .sort((a, b) => (b[0].createdAt - a[0].createdAt) || (b[1] - a[1]))
    .map(([p]) => p);
}

// `show` is 'all' or 'revisit'. `topicId` '' means any topic.
export function filterProblems(problems, { show = 'all', topicId = '', query = '' } = {}) {
  const q = query.trim().toLowerCase();
  return sortedProblems(problems).filter((p) => {
    if (show === 'revisit' && !p.revisit) return false;
    if (topicId && p.topicId !== topicId) return false;
    if (!q) return true;
    const topic = TOPIC_BY_ID[p.topicId];
    const haystack = [p.name, p.idea, topic ? topic.title : ''].join(' ').toLowerCase();
    return q.split(/\s+/).every((word) => haystack.includes(word));
  });
}

export function revisitCount(state) {
  return state.problems.filter((p) => p.revisit).length;
}

// Counts for each real mistake type ('None' excluded), most frequent first.
export function mistakePatterns(problems) {
  const types = MISTAKES.filter((m) => m.id !== 'none');
  return types
    .map((m, order) => ({ id: m.id, label: m.label, count: problems.filter((p) => p.mistake === m.id).length, order }))
    .sort((a, b) => (b.count - a.count) || (a.order - b.order))
    .map(({ id, label, count }) => ({ id, label, count }));
}

// ---------- preferences ----------

export function setTheme(state, theme) {
  if (!THEMES.includes(theme) || state.prefs.theme === theme) return state;
  return { ...state, prefs: { ...state.prefs, theme } };
}

export function setSidebar(state, sidebar) {
  if (!SIDEBAR_STATES.includes(sidebar) || state.prefs.sidebar === sidebar) return state;
  return { ...state, prefs: { ...state.prefs, sidebar } };
}

// 'light' or 'dark'. A 'system' preference follows the operating system.
export function resolveTheme(pref, systemPrefersDark) {
  if (pref === 'light' || pref === 'dark') return pref;
  return systemPrefersDark ? 'dark' : 'light';
}
