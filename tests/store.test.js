import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, WEEKS, STEPS, topicsForWeek } from '../src/data.js';
import {
  STORAGE_KEY, BACKUP_KEY, SCHEMA_VERSION, TOTAL_STEPS,
  defaultState, migrate, load, save, createStore,
  toggleStep, setStep, setNotes, stepsDone, isTopicDone, totalStepsDone, nextTopic, topicMatches,
  setWeekCheck, weekChecklist, weekStatus, weekFill, currentWeek,
  validateProblem, addProblem, updateProblem, deleteProblem, markResolved,
  filterProblems, sortedProblems, revisitCount, mistakePatterns, isHttpUrl, defaultRevisit,
} from '../src/store.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
}

function finishTopic(state, topicId) {
  return STEPS.reduce((s, step) => setStep(s, topicId, step.key, true), state);
}

function finishWeek(state, n) {
  let s = state;
  for (const t of topicsForWeek(n)) s = finishTopic(s, t.id);
  const week = WEEKS.find((w) => w.n === n);
  for (const item of week.checklist) if (!item.derived) s = setWeekCheck(s, n, item.id, true);
  return s;
}

describe('static data', () => {
  test('has 37 topics, 185 steps and exactly 8 weeks', () => {
    assert.equal(TOPICS.length, 37);
    assert.equal(TOTAL_STEPS, 185);
    assert.equal(WEEKS.length, 8);
    assert.deepEqual(WEEKS.map((w) => w.n), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(topicsForWeek(8).length, 0);
    assert.ok(TOPICS.every((t) => t.week >= 1 && t.week <= 7));
  });

  test('topic ids are unique and every URL is https', () => {
    assert.equal(new Set(TOPICS.map((t) => t.id)).size, TOPICS.length);
    for (const t of TOPICS) {
      for (const url of [t.visualize, t.reference]) if (url) assert.ok(url.startsWith('https://'), url);
    }
  });

  test('only week 7 Edge topics are optional', () => {
    const optional = TOPICS.filter((t) => t.optional).map((t) => t.id);
    assert.deepEqual(optional, ['g_hld', 'g_cen', 'g_cht', 'g_fft']);
  });
});

describe('topic steps', () => {
  test('toggleStep flips one step without mutating the input', () => {
    const s0 = defaultState();
    const s1 = toggleStep(s0, 'c3', 'read');
    assert.equal(s0.topics.c3.read, false);
    assert.equal(s1.topics.c3.read, true);
    assert.equal(stepsDone(s1, 'c3'), 1);
    const s2 = toggleStep(s1, 'c3', 'read');
    assert.equal(s2.topics.c3.read, false);
    assert.equal(stepsDone(s2, 'c3'), 0);
  });

  test('unknown topics and step keys are ignored', () => {
    const s0 = defaultState();
    assert.equal(toggleStep(s0, 'nope', 'read'), s0);
    assert.equal(toggleStep(s0, 'c1', 'nope'), s0);
  });

  test('a topic is done at 5 of 5 steps and counts towards the total', () => {
    const s = finishTopic(defaultState(), 'c1');
    assert.equal(isTopicDone(s, 'c1'), true);
    assert.equal(totalStepsDone(s), 5);
  });

  test('setNotes keeps step progress and returns the same state when unchanged', () => {
    const s1 = setNotes(toggleStep(defaultState(), 'c7', 'code'), 'c7', 'dp[i] = ...');
    assert.equal(s1.topics.c7.notes, 'dp[i] = ...');
    assert.equal(s1.topics.c7.code, true);
    assert.equal(setNotes(s1, 'c7', 'dp[i] = ...'), s1);
  });

  test('nextTopic follows plan order and picks the next unfinished step', () => {
    let s = defaultState();
    assert.equal(nextTopic(s).topic.id, 'c1');
    assert.equal(nextTopic(s).step.key, 'read');
    s = finishTopic(s, 'c1');
    s = setStep(s, 'c2', 'read', true);
    assert.equal(nextTopic(s).topic.id, 'c2');
    assert.equal(nextTopic(s).step.key, 'visual');
    for (const t of TOPICS) s = finishTopic(s, t.id);
    assert.equal(nextTopic(s), null);
  });

  test('topicMatches filters by finished state and search words', () => {
    const s = finishTopic(defaultState(), 'c3');
    const c3 = TOPICS.find((t) => t.id === 'c3');
    const c4 = TOPICS.find((t) => t.id === 'c4');
    assert.equal(topicMatches(s, c3, { show: 'done' }), true);
    assert.equal(topicMatches(s, c3, { show: 'open' }), false);
    assert.equal(topicMatches(s, c4, { show: 'open' }), true);
    assert.equal(topicMatches(s, c3, { query: 'binary SORT' }), true);
    assert.equal(topicMatches(s, c3, { query: 'graph' }), false);
  });
});

describe('weeks', () => {
  test('a new state starts at week 1 with every week not started', () => {
    const s = defaultState();
    assert.equal(currentWeek(s), 1);
    for (const w of WEEKS) assert.equal(weekStatus(s, w.n), 'not-started');
  });

  test('the loop item is derived from topic steps', () => {
    let s = defaultState();
    const loop = () => weekChecklist(s, 1).find((i) => i.id === 'loop');
    assert.equal(loop().done, false);
    assert.equal(loop().progress.total, 35);
    for (const t of topicsForWeek(1)) s = finishTopic(s, t.id);
    assert.equal(loop().done, true);
    assert.equal(loop().progress.done, 35);
  });

  test('the derived loop item cannot be set by hand', () => {
    const s0 = defaultState();
    assert.equal(setWeekCheck(s0, 1, 'loop', true), s0);
    assert.equal(setWeekCheck(s0, 9, 'practice', true), s0);
  });

  test('week status goes not started → in progress → done', () => {
    let s = defaultState();
    s = setStep(s, 'c11', 'read', true);
    assert.equal(weekStatus(s, 3), 'in-progress');
    s = setWeekCheck(defaultState(), 3, 'contests', true);
    assert.equal(weekStatus(s, 3), 'in-progress');
    s = finishWeek(defaultState(), 3);
    assert.equal(weekStatus(s, 3), 'done');
    s = setWeekCheck(s, 3, 'contests', false);
    assert.equal(weekStatus(s, 3), 'in-progress');
  });

  test('week 8 has its own four manual items', () => {
    let s = defaultState();
    const items = weekChecklist(s, 8);
    assert.deepEqual(items.map((i) => i.id), ['virtuals', 'upsolve', 'clear', 'patterns']);
    assert.ok(items.every((i) => !i.derived));
    s = finishWeek(s, 8);
    assert.equal(weekStatus(s, 8), 'done');
  });

  test('week 7 optional topics do not block the loop item', () => {
    let s = defaultState();
    s = finishTopic(s, 'c29');
    s = finishTopic(s, 'c30');
    const loop = weekChecklist(s, 7).find((i) => i.id === 'loop');
    assert.equal(loop.done, true);
    assert.match(loop.label, /isn't optional/);
  });

  test('current week is the first week whose checklist is not fully done', () => {
    let s = defaultState();
    s = finishWeek(s, 1);
    assert.equal(currentWeek(s), 2);
    s = finishWeek(s, 3);
    assert.equal(currentWeek(s), 2, 'finishing a later week does not skip an unfinished one');
    for (const w of WEEKS) s = finishWeek(s, w.n);
    assert.equal(currentWeek(s), null);
  });

  test('weekFill grows with the checklist', () => {
    let s = defaultState();
    assert.equal(weekFill(s, 1), 0);
    s = setWeekCheck(s, 1, 'practice', true);
    assert.equal(weekFill(s, 1), 0.25);
    s = finishWeek(s, 1);
    assert.equal(weekFill(s, 1), 1);
  });
});

describe('problems', () => {
  const base = { name: 'Two Sets', url: 'https://cses.fi/problemset/task/1092', topicId: 'c6', result: 'hint', mistake: 'idea', idea: 'Greedy from n down' };

  test('validation requires a name', () => {
    assert.equal(validateProblem({ ...base, name: '   ' }).ok, false);
    assert.ok(validateProblem({ ...base, name: '' }).errors.name);
    assert.equal(validateProblem(base).ok, true);
  });

  test('validation accepts only http and https links', () => {
    assert.equal(validateProblem({ ...base, url: '' }).ok, true);
    assert.equal(validateProblem({ ...base, url: 'http://example.com/p' }).ok, true);
    for (const bad of ['javascript:alert(1)', 'ftp://example.com', 'cses.fi/problemset', 'data:text/html,hi', 'https://']) {
      const v = validateProblem({ ...base, url: bad });
      assert.equal(v.ok, false, bad);
      assert.ok(v.errors.url, bad);
    }
    assert.equal(isHttpUrl('HTTPS://EXAMPLE.COM'), true);
  });

  test('revisit defaults to on unless the result is "Solved alone"', () => {
    assert.equal(defaultRevisit('alone'), false);
    assert.equal(defaultRevisit('hint'), true);
    assert.equal(validateProblem({ ...base, result: 'alone' }).value.revisit, false);
    assert.equal(validateProblem({ ...base, result: 'editorial' }).value.revisit, true);
    assert.equal(validateProblem({ ...base, result: 'alone', revisit: true }).value.revisit, true);
  });

  test('addProblem stores a cleaned problem with createdAt and resolvedCount', () => {
    const s0 = defaultState();
    const { state, problem, errors } = addProblem(s0, { ...base, name: '  Two Sets  ' }, { now: 1000, id: 'p1' });
    assert.equal(errors, undefined);
    assert.equal(s0.problems.length, 0);
    assert.equal(state.problems.length, 1);
    assert.deepEqual(problem, {
      id: 'p1', name: 'Two Sets', url: base.url, topicId: 'c6', result: 'hint', mistake: 'idea',
      idea: 'Greedy from n down', revisit: true, resolvedCount: 0, createdAt: 1000,
    });
  });

  test('addProblem rejects invalid input and leaves state unchanged', () => {
    const s0 = defaultState();
    const r = addProblem(s0, { ...base, name: '', url: 'javascript:alert(1)' });
    assert.equal(r.state, s0);
    assert.ok(r.errors.name);
    assert.ok(r.errors.url);
  });

  test('updateProblem edits fields but keeps id, createdAt and resolvedCount', () => {
    let s = addProblem(defaultState(), base, { now: 1000, id: 'p1' }).state;
    s = markResolved(s, 'p1');
    const r = updateProblem(s, 'p1', { ...base, name: 'Two Sets II', mistake: 'edge', revisit: true });
    assert.equal(r.problem.name, 'Two Sets II');
    assert.equal(r.problem.mistake, 'edge');
    assert.equal(r.problem.id, 'p1');
    assert.equal(r.problem.createdAt, 1000);
    assert.equal(r.problem.resolvedCount, 1);
    assert.ok(updateProblem(s, 'p1', { ...base, url: 'nope' }).errors.url);
    assert.ok(updateProblem(s, 'missing', base).errors.form);
  });

  test('deleteProblem removes only that problem', () => {
    let s = addProblem(defaultState(), base, { now: 1, id: 'a' }).state;
    s = addProblem(s, { ...base, name: 'Other' }, { now: 2, id: 'b' }).state;
    s = deleteProblem(s, 'a');
    assert.deepEqual(s.problems.map((p) => p.id), ['b']);
    assert.equal(deleteProblem(s, 'missing'), s);
  });

  test('"Re-solved it" clears revisit and increments resolvedCount', () => {
    let s = addProblem(defaultState(), base, { now: 1, id: 'p1' }).state;
    assert.equal(revisitCount(s), 1);
    s = markResolved(s, 'p1');
    assert.equal(s.problems[0].revisit, false);
    assert.equal(s.problems[0].resolvedCount, 1);
    assert.equal(revisitCount(s), 0);
    s = markResolved(s, 'p1');
    assert.equal(s.problems[0].resolvedCount, 2);
  });

  test('lists are newest first and filter by revisit, topic and text', () => {
    let s = defaultState();
    s = addProblem(s, { ...base, name: 'Old one', topicId: 'c6' }, { now: 1, id: 'a' }).state;
    s = addProblem(s, { ...base, name: 'New one', topicId: 'c7', result: 'alone', idea: 'knapsack' }, { now: 3, id: 'b' }).state;
    s = addProblem(s, { ...base, name: 'Same time', topicId: 'c7' }, { now: 3, id: 'c' }).state;
    assert.deepEqual(sortedProblems(s.problems).map((p) => p.id), ['c', 'b', 'a']);
    assert.deepEqual(filterProblems(s.problems, { show: 'revisit' }).map((p) => p.id), ['c', 'a']);
    assert.deepEqual(filterProblems(s.problems, { topicId: 'c7' }).map((p) => p.id), ['c', 'b']);
    assert.deepEqual(filterProblems(s.problems, { query: 'KNAPSACK' }).map((p) => p.id), ['b']);
    assert.deepEqual(filterProblems(s.problems, { query: 'dynamic' }).map((p) => p.id), ['c', 'b'], 'matches topic title');
  });

  test('mistake patterns count each type, most frequent first, without "None"', () => {
    const problems = [
      { mistake: 'edge' }, { mistake: 'bug' }, { mistake: 'edge' }, { mistake: 'none' },
    ];
    const patterns = mistakePatterns(problems);
    assert.deepEqual(patterns.map((p) => [p.id, p.count]), [
      ['edge', 2], ['bug', 1], ['idea', 0], ['limits', 0], ['misread', 0],
    ]);
  });
});

describe('migration and persistence', () => {
  test('migrate fills in a full default state from nothing', () => {
    for (const raw of [undefined, null, 42, 'x', [], {}]) {
      const s = migrate(raw);
      assert.equal(s.version, SCHEMA_VERSION);
      assert.equal(Object.keys(s.topics).length, 37);
      assert.deepEqual(s.weekChecks, {});
      assert.deepEqual(s.problems, []);
    }
  });

  test('migrate upgrades an old unversioned state and cleans bad values', () => {
    const old = {
      topics: { c1: { read: true, code: 'yes', notes: 'hi' }, c2: 'garbage' },
      weekChecks: { 1: { practice: true, loop: true, bogus: true }, 12: { practice: true } },
      problems: [
        { name: 'Kept', url: 'javascript:alert(1)', topicId: 'zzz', result: 'weird', revisit: true, resolvedCount: -3 },
        { name: '' },
        'garbage',
        { id: 'dup', name: 'A', createdAt: 5 },
        { id: 'dup', name: 'B', createdAt: 6 },
      ],
    };
    const s = migrate(old);
    assert.equal(s.version, 1);
    assert.deepEqual(s.topics.c1, { read: true, visual: false, code: false, practice: false, revise: false, notes: 'hi' });
    assert.equal(stepsDone(s, 'c2'), 0);
    assert.equal(Object.keys(s.topics).length, 37);
    assert.deepEqual(s.weekChecks, { 1: { practice: true } });
    assert.equal(s.problems.length, 3);
    const kept = s.problems[0];
    assert.equal(kept.url, '');
    assert.equal(kept.topicId, '');
    assert.equal(kept.result, 'hint');
    assert.equal(kept.resolvedCount, 0);
    assert.equal(kept.revisit, true);
    assert.ok(kept.id);
    assert.equal(new Set(s.problems.map((p) => p.id)).size, 3, 'ids are made unique');
  });

  test('migrate keeps a current state intact', () => {
    let s = toggleStep(defaultState(), 'c9', 'practice');
    s = setWeekCheck(s, 2, 'contests', true);
    s = addProblem(s, { name: 'Range Sum Queries II', topicId: 'c9' }, { now: 7, id: 'p' }).state;
    assert.deepEqual(migrate(JSON.parse(JSON.stringify(s))), s);
  });

  test('load returns defaults for empty storage', () => {
    const r = load(memoryStorage());
    assert.equal(r.status, 'empty');
    assert.deepEqual(r.state, defaultState());
  });

  test('save then load round-trips under the versioned key', () => {
    const storage = memoryStorage();
    const s = setNotes(toggleStep(defaultState(), 'c1', 'read'), 'c1', 'cin.tie(0)');
    assert.deepEqual(save(storage, s), { ok: true });
    assert.ok(storage.data.has(STORAGE_KEY));
    const r = load(storage);
    assert.equal(r.status, 'ok');
    assert.deepEqual(r.state, s);
  });

  test('corrupted JSON falls back to defaults and keeps the raw value in a backup key', () => {
    for (const raw of ['{"version":1,"topics":', 'not json at all', '[1,2,3]', 'null']) {
      const storage = memoryStorage({ [STORAGE_KEY]: raw });
      const r = load(storage);
      assert.equal(r.status, 'corrupt', raw);
      assert.deepEqual(r.state, defaultState());
      assert.equal(storage.getItem(BACKUP_KEY), raw);
      assert.equal(storage.getItem(STORAGE_KEY), raw, 'the original is left alone until the next save');
    }
  });

  test('storage that throws on read or write is reported, not thrown', () => {
    const broken = {
      getItem() { throw new Error('SecurityError'); },
      setItem() { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; },
    };
    assert.equal(load(broken).status, 'unavailable');
    assert.deepEqual(save(broken, defaultState()), { ok: false, error: 'quota' });
    assert.equal(load(null).status, 'unavailable');
    assert.deepEqual(save(null, defaultState()), { ok: false, error: 'unavailable' });
  });

  test('createStore commits, saves and reports save results', () => {
    const storage = memoryStorage();
    const results = [];
    const store = createStore({ storage, onSave: (r) => results.push(r) });
    assert.equal(store.loadStatus, 'empty');
    store.commit(toggleStep(store.get(), 'c1', 'read'));
    assert.equal(store.get().topics.c1.read, true);
    assert.deepEqual(results, [{ ok: true }]);
    store.commit(store.get());
    assert.equal(results.length, 1, 'committing the same state does not save again');
    assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).topics.c1.read, true);
  });
});
