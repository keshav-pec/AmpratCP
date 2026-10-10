import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, WEEKS, STEPS, topicsForWeek, handbookUrl } from '../src/data.js';
import { PRACTICE, csesUrl, codeforcesUrl } from '../src/practice.js';
import {
  STORAGE_KEY, BACKUP_KEY, SCHEMA_VERSION, TOTAL_STEPS,
  defaultState, migrate, load, save, createStore,
  toggleStep, setStep, setNotes, stepsDone, isTopicDone, totalStepsDone, nextTopic, topicMatches,
  setWeekCheck, weekChecklist, weekStatus, weekFill, currentWeek,
  validateProblem, addProblem, updateProblem, deleteProblem, markResolved,
  filterProblems, sortedProblems, revisitCount, mistakePatterns, isHttpUrl, defaultRevisit,
  weekPracticeCounts, setTheme, setSidebar, resolveTheme,
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
  test('has 43 topics, 86 steps and exactly 8 weeks', () => {
    assert.equal(TOPICS.length, 43);
    assert.equal(TOTAL_STEPS, 86);
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

  test('every topic has exact CSES and Codeforces practice problems', () => {
    assert.deepEqual(Object.keys(PRACTICE).sort(), TOPICS.map((t) => t.id).sort());
    for (const t of TOPICS) {
      const { cses, cf } = t.practice;
      assert.ok(cses.length >= 1, `${t.id} has a CSES problem`);
      assert.ok(cf.length >= 3, `${t.id} has at least 3 Codeforces problems`);
      for (const [id, name] of cses) {
        assert.ok(Number.isInteger(id) && id >= 1000 && id < 10000, `${t.id}: CSES id ${id}`);
        assert.ok(name.trim(), `${t.id}: CSES ${id} has a name`);
      }
      for (const [code, name] of cf) {
        assert.match(code, /^\d+[A-Z]\d?$/, `${t.id}: Codeforces code ${code}`);
        assert.ok(name.trim(), `${t.id}: Codeforces ${code} has a name`);
      }
      assert.equal(new Set(cses.map(([id]) => id)).size, cses.length, `${t.id}: no duplicate CSES ids`);
      assert.equal(new Set(cf.map(([c]) => c)).size, cf.length, `${t.id}: no duplicate Codeforces codes`);
    }
  });

  test('practice links point at the exact problem pages', () => {
    assert.equal(csesUrl(1640), 'https://cses.fi/problemset/task/1640');
    assert.equal(codeforcesUrl('279B'), 'https://codeforces.com/problemset/problem/279/B');
    assert.equal(codeforcesUrl('1526C2'), 'https://codeforces.com/problemset/problem/1526/C2');
    assert.throws(() => codeforcesUrl('bad'));
  });

  test('week practice counts add up the week\'s topics', () => {
    const w1 = topicsForWeek(1);
    assert.deepEqual(weekPracticeCounts(1), {
      cses: w1.reduce((n, t) => n + t.practice.cses.length, 0),
      cf: w1.reduce((n, t) => n + t.practice.cf.length, 0),
    });
    assert.deepEqual(weekPracticeCounts(8), { cses: 0, cf: 0 });
  });

  test('Edge topics, and only Edge topics, are optional', () => {
    const optional = TOPICS.filter((t) => t.optional).map((t) => t.id);
    assert.deepEqual(optional, ['g_sa', 'g_mcmf', 'g_hld', 'g_cen', 'g_cht', 'g_fft']);
    assert.ok(TOPICS.every((t) => t.optional === (t.priority === 'Edge')));
  });

  test('every topic says what to master, and book topics have a chapter and page', () => {
    for (const t of TOPICS) {
      assert.ok(t.focus && t.focus.length > 20, `${t.id} has a focus line`);
      assert.equal(t.chapter === null, t.page === null, `${t.id}: chapter and page go together`);
    }
  });

  test('weeks run in dependency order: each topic comes after what it builds on', () => {
    const weekOf = Object.fromEntries(TOPICS.map((t) => [t.id, t.week]));
    const before = [
      ['c9p', 'c9'], ['c5', 'c7'], ['c7', 'g_int'], ['c7', 'g_digit'], ['c10', 'g_xor'], ['c21', 'c22'], ['c22', 'c24'],
      ['c12', 'c13'], ['c15', 'c14'], ['c9', 'c28'], ['c14', 'c18m'], ['c12', 'g_brg'], ['c18', 'g_hld'], ['c9', 'c27'],
    ];
    for (const [first, then] of before) assert.ok(weekOf[first] <= weekOf[then], `${first} before ${then}`);
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

  test('a topic is done at 2 of 2 steps and counts towards the total', () => {
    const s = finishTopic(defaultState(), 'c1');
    assert.equal(isTopicDone(s, 'c1'), true);
    assert.equal(totalStepsDone(s), 2);
  });

  test('setNotes keeps step progress and returns the same state when unchanged', () => {
    const s1 = setNotes(toggleStep(defaultState(), 'c7', 'practice'), 'c7', 'dp[i] = ...');
    assert.equal(s1.topics.c7.notes, 'dp[i] = ...');
    assert.equal(s1.topics.c7.practice, true);
    assert.equal(setNotes(s1, 'c7', 'dp[i] = ...'), s1);
  });

  test('nextTopic follows plan order and picks the next unfinished step', () => {
    let s = defaultState();
    assert.equal(nextTopic(s).topic.id, 'c1');
    assert.equal(nextTopic(s).step.key, 'read');
    s = finishTopic(s, 'c1');
    s = setStep(s, 'c2', 'read', true);
    assert.equal(nextTopic(s).topic.id, 'c2');
    assert.equal(nextTopic(s).step.key, 'practice');
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
    assert.equal(topicMatches(s, c3, { query: 'ferris wheel' }), true, 'matches practice problem names');
    assert.equal(topicMatches(s, c3, { query: '1201c' }), true, 'matches problem ids');
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
    assert.equal(loop().progress.total, 14);
    for (const t of topicsForWeek(1)) s = finishTopic(s, t.id);
    assert.equal(loop().done, true);
    assert.equal(loop().progress.done, 14);
  });

  test('the derived loop item cannot be set by hand', () => {
    const s0 = defaultState();
    assert.equal(setWeekCheck(s0, 1, 'loop', true), s0);
    assert.equal(setWeekCheck(s0, 9, 'practice', true), s0);
  });

  test('week status goes not started → in progress → done', () => {
    let s = defaultState();
    s = setStep(s, 'c11', 'read', true);
    assert.equal(weekStatus(s, 4), 'in-progress');
    s = setWeekCheck(defaultState(), 4, 'contests', true);
    assert.equal(weekStatus(s, 4), 'in-progress');
    s = finishWeek(defaultState(), 4);
    assert.equal(weekStatus(s, 4), 'done');
    s = setWeekCheck(s, 4, 'mock', false);
    assert.equal(weekStatus(s, 4), 'in-progress');
  });

  test('week 8 has its own manual items, including team practice', () => {
    let s = defaultState();
    const items = weekChecklist(s, 8);
    assert.deepEqual(items.map((i) => i.id), ['virtuals', 'team', 'upsolve', 'clear', 'patterns', 'routine']);
    assert.ok(items.every((i) => !i.derived));
    s = finishWeek(s, 8);
    assert.equal(weekStatus(s, 8), 'done');
  });

  test('optional topics do not block the loop item', () => {
    let s = defaultState();
    for (const id of ['c29', 'c30', 'c20', 'c23', 'c27']) s = finishTopic(s, id);
    const loop = weekChecklist(s, 7).find((i) => i.id === 'loop');
    assert.equal(loop.done, true);
    assert.match(loop.label, /isn't optional/);
    assert.equal(weekChecklist(s, 4).find((i) => i.id === 'loop').label, 'Finish both steps for every topic');
  });

  test('checkpoint mock contests sit in weeks 4 and 6, and a stress test in week 1', () => {
    const ids = (n) => weekChecklist(defaultState(), n).map((i) => i.id);
    assert.ok(ids(4).includes('mock'));
    assert.ok(ids(6).includes('mock'));
    assert.ok(ids(1).includes('stress'));
    assert.ok(!ids(2).includes('mock'));
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
    assert.equal(weekFill(s, 2), 0);
    s = setWeekCheck(s, 2, 'practice', true);
    assert.equal(weekFill(s, 2), 0.25);
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

describe('preferences', () => {
  test('default to the system theme and an expanded sidebar', () => {
    assert.deepEqual(defaultState().prefs, { theme: 'system', sidebar: 'expanded' });
  });

  test('setTheme and setSidebar accept only known values', () => {
    const s0 = defaultState();
    const s1 = setTheme(s0, 'dark');
    assert.equal(s1.prefs.theme, 'dark');
    assert.equal(s0.prefs.theme, 'system');
    assert.equal(setTheme(s1, 'dark'), s1);
    assert.equal(setTheme(s0, 'purple'), s0);
    const s2 = setSidebar(s1, 'collapsed');
    assert.deepEqual(s2.prefs, { theme: 'dark', sidebar: 'collapsed' });
    assert.equal(setSidebar(s2, 'sideways'), s2);
  });

  test('resolveTheme follows the system only for the system preference', () => {
    assert.equal(resolveTheme('system', true), 'dark');
    assert.equal(resolveTheme('system', false), 'light');
    assert.equal(resolveTheme('light', true), 'light');
    assert.equal(resolveTheme('dark', false), 'dark');
  });

  test('migrate keeps valid prefs, fixes bad ones and fills them in for older states', () => {
    assert.deepEqual(migrate({ prefs: { theme: 'dark', sidebar: 'collapsed' } }).prefs, { theme: 'dark', sidebar: 'collapsed' });
    assert.deepEqual(migrate({ prefs: { theme: 'neon', sidebar: 3 } }).prefs, { theme: 'system', sidebar: 'expanded' });
    assert.deepEqual(migrate({ version: 1, topics: {}, weekChecks: {}, problems: [] }).prefs, { theme: 'system', sidebar: 'expanded' });
  });
});

describe('migration and persistence', () => {
  test('migrate fills in a full default state from nothing', () => {
    for (const raw of [undefined, null, 42, 'x', [], {}]) {
      const s = migrate(raw);
      assert.equal(s.version, SCHEMA_VERSION);
      assert.equal(Object.keys(s.topics).length, TOPICS.length);
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
    assert.equal(s.version, SCHEMA_VERSION);
    assert.deepEqual(s.topics.c1, { read: false, practice: false, notes: 'hi' });
    assert.equal(stepsDone(s, 'c2'), 0);
    assert.equal(Object.keys(s.topics).length, TOPICS.length);
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

  test('migrate moves version 1 week checks to the week that now holds that theme', () => {
    const v1 = {
      version: 1,
      weekChecks: {
        1: { contests: true }, // foundations stays week 1
        3: { practice: true }, // old graphs week is now week 4
        4: { revisit: true }, // old trees week is now week 5
        5: { contests: true }, // old maths week is now week 3
        8: { virtuals: true, clear: true },
      },
    };
    assert.deepEqual(migrate(v1).weekChecks, {
      1: { contests: true },
      3: { contests: true },
      4: { practice: true },
      5: { revisit: true },
      8: { virtuals: true, clear: true },
    });
    // Topic progress is keyed by topic, so it moves with its topic automatically.
    const withSteps = migrate({ version: 1, topics: { c9: { read: true, visual: true } } });
    assert.equal(withSteps.topics.c9.read, true);
    assert.equal(TOPICS.find((t) => t.id === 'c9').week, 5);
  });

  test('migrate merges the five version 2 steps into two', () => {
    const s = migrate({
      version: 2,
      topics: {
        c1: { read: true, visual: true, code: true, practice: true, revise: true },
        c2: { read: true, visual: false, code: true, practice: false, revise: true },
        c3: { visual: true, practice: true, notes: 'kept' },
      },
    });
    assert.deepEqual(s.topics.c1, { read: true, practice: true, notes: '' });
    assert.deepEqual(s.topics.c2, { read: false, practice: false, notes: '' });
    assert.deepEqual(s.topics.c3, { read: false, practice: false, notes: 'kept' });
    assert.equal(isTopicDone(s, 'c1'), true);
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

  test('reload picks up what another tab saved, so this tab does not overwrite it', () => {
    const storage = memoryStorage();
    const tabA = createStore({ storage });
    const tabB = createStore({ storage });
    tabA.commit(toggleStep(tabA.get(), 'c1', 'read'));
    assert.equal(tabB.reload(), true);
    tabB.commit(toggleStep(tabB.get(), 'c2', 'read'));
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    assert.equal(saved.topics.c1.read, true, "tab A's change survives tab B's save");
    assert.equal(saved.topics.c2.read, true);
    assert.equal(tabB.reload(), false, 'nothing new to load');
  });

  test('reload ignores unreadable data and keeps the current state', () => {
    const storage = memoryStorage();
    const store = createStore({ storage });
    store.commit(toggleStep(store.get(), 'c1', 'read'));
    storage.setItem(STORAGE_KEY, '{broken');
    assert.equal(store.reload(), false);
    assert.equal(store.get().topics.c1.read, true);
  });

  test('reload follows a cleared storage back to defaults', () => {
    const storage = memoryStorage();
    const store = createStore({ storage });
    store.commit(toggleStep(store.get(), 'c1', 'read'));
    storage.removeItem(STORAGE_KEY);
    assert.equal(store.reload(), true);
    assert.deepEqual(store.get(), defaultState());
  });
});

describe('topic numbers and handbook links', () => {
  test('topics are numbered 1, 2, 3… in plan order', () => {
    assert.deepEqual(TOPICS.map((t) => t.number), TOPICS.map((_, i) => i + 1));
    for (const w of WEEKS) {
      const nums = topicsForWeek(w.n).map((t) => t.number);
      nums.forEach((n, i) => { if (i) assert.equal(n, nums[i - 1] + 1, `week ${w.n} runs in order`); });
    }
  });

  test('handbook links open the reader on the PDF page, 10 after the printed page', () => {
    assert.equal(handbookUrl(25), './book.html#page=35');
    assert.equal(handbookUrl(84), './book.html#page=94');
  });
});
