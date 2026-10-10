import { test } from 'node:test';
import assert from 'node:assert/strict';
import { merge3, deepEqual } from '../src/merge.js';
import { defaultState, syncedData, setStep, setNotes, setWeekCheck, addProblem, updateProblem, deleteProblem, markResolved } from '../src/store.js';

const empty = () => syncedData(defaultState());
const withProblem = (data, name, id) => syncedData(addProblem({ ...data, prefs: defaultState().prefs }, { name }, { id, now: 1 }).state);
const full = (data) => ({ ...data, prefs: defaultState().prefs });

test('deepEqual compares JSON values, ignoring key order', () => {
  assert.equal(deepEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }), true);
  assert.equal(deepEqual({ a: 1 }, { a: 1, b: undefined }), false);
  assert.equal(deepEqual([1, 2], [2, 1]), false);
  assert.equal(deepEqual(null, {}), false);
  assert.equal(deepEqual('1', 1), false);
});

test('keeps changes made on either side', () => {
  const base = empty();
  const local = syncedData(setStep(full(base), 'c1', 'read', true));
  const remote = syncedData(setStep(full(base), 'c2', 'practice', true));
  const merged = merge3(base, local, remote);
  assert.equal(merged.topics.c1.read, true);
  assert.equal(merged.topics.c2.practice, true);
  assert.deepEqual(merge3(base, local, base), local);
  assert.deepEqual(merge3(base, base, remote), remote);
});

test('when both changed the same step, this device wins', () => {
  const base = syncedData(setStep(full(empty()), 'c1', 'read', true));
  const local = syncedData(setStep(full(base), 'c1', 'read', false));
  const remote = syncedData(setStep(full(base), 'c1', 'practice', true));
  const merged = merge3(base, local, remote);
  assert.equal(merged.topics.c1.read, false);
  assert.equal(merged.topics.c1.practice, true);
});

test('keeps both versions of a note edited on two devices', () => {
  const base = syncedData(setNotes(full(empty()), 'c3', 'binary search'));
  const local = syncedData(setNotes(full(base), 'c3', 'binary search on the answer'));
  const remote = syncedData(setNotes(full(base), 'c3', 'lower_bound, upper_bound'));
  assert.equal(merge3(base, local, remote).topics.c3.notes, 'binary search on the answer\n\nlower_bound, upper_bound');
  // If one version already contains the other, nothing is repeated.
  const longer = syncedData(setNotes(full(base), 'c3', 'lower_bound, upper_bound and more'));
  assert.equal(merge3(base, longer, remote).topics.c3.notes, 'lower_bound, upper_bound and more');
  // Clearing a note on one side and editing it on the other keeps the edit.
  const cleared = syncedData(setNotes(full(base), 'c3', ''));
  assert.equal(merge3(base, cleared, remote).topics.c3.notes, 'lower_bound, upper_bound');
});

test('merges week checklists item by item', () => {
  const base = syncedData(setWeekCheck(full(empty()), 1, 'practice', true));
  const local = syncedData(setWeekCheck(full(base), 1, 'practice', false));
  const remote = syncedData(setWeekCheck(full(base), 1, 'revisit', true));
  assert.deepEqual(merge3(base, local, remote).weekChecks, { 1: { revisit: true } });
});

test('merges logged problems by id', () => {
  const base = withProblem(withProblem(empty(), 'Kept', 'p1'), 'Gone', 'p2');
  let local = syncedData(deleteProblem(full(base), 'p2'));
  local = withProblem(local, 'Added here', 'p3');
  let remote = syncedData(markResolved(full(base), 'p1'));
  remote = withProblem(remote, 'Added there', 'p4');
  const merged = merge3(base, local, remote);
  assert.deepEqual(merged.problems.map((p) => p.id), ['p1', 'p4', 'p3']);
  assert.equal(merged.problems[0].resolvedCount, 1);
});

test('an edit beats a delete', () => {
  const base = withProblem(empty(), 'Two Sets', 'p1');
  const local = syncedData(updateProblem(full(base), 'p1', { name: 'Two Sets II', result: 'hint' }).state);
  const remote = syncedData(deleteProblem(full(base), 'p1'));
  assert.equal(merge3(base, local, remote).problems[0].name, 'Two Sets II');
  assert.equal(merge3(base, remote, local).problems[0].name, 'Two Sets II');
  // A delete on one side with no edit on the other stays deleted.
  assert.deepEqual(merge3(base, remote, base).problems, []);
  assert.deepEqual(merge3(base, base, remote).problems, []);
});

test('the first sync of two devices that both have progress keeps everything', () => {
  let laptop = syncedData(setStep(full(empty()), 'c1', 'read', true));
  laptop = syncedData(setNotes(full(laptop), 'c1', 'laptop notes'));
  laptop = withProblem(laptop, 'From laptop', 'pa');
  let phone = syncedData(setStep(full(empty()), 'c2', 'read', true));
  phone = syncedData(setNotes(full(phone), 'c1', 'phone notes'));
  phone = withProblem(phone, 'From phone', 'pb');
  const merged = merge3(empty(), phone, laptop);
  assert.equal(merged.topics.c1.read, true);
  assert.equal(merged.topics.c2.read, true);
  assert.equal(merged.topics.c1.notes, 'phone notes\n\nlaptop notes');
  assert.deepEqual(merged.problems.map((p) => p.name).sort(), ['From laptop', 'From phone']);
});

test('ignores keys that could change an object’s prototype', () => {
  const remote = JSON.parse('{"topics":{"__proto__":{"polluted":true}}}');
  const merged = merge3({ topics: {} }, { topics: { c1: 1 } }, remote);
  assert.equal(Object.getPrototypeOf(merged.topics), Object.prototype);
  assert.equal({}.polluted, undefined);
});
