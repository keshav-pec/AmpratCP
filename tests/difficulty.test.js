import test from 'node:test';
import assert from 'node:assert/strict';
import { TOPICS } from '../src/data.js';
import { LEVELS, csesDifficulty, cfDifficulty } from '../src/difficulty.js';

test('every practice problem has a difficulty', () => {
  for (const t of TOPICS) {
    for (const [id] of t.practice.cses) assert.ok(csesDifficulty(id), `CSES ${id} (${t.id}) has no difficulty`);
    for (const [code] of t.practice.cf) assert.ok(cfDifficulty(code), `Codeforces ${code} (${t.id}) has no rating`);
  }
});

test('CSES problems use the label from the solve-count sheet', () => {
  assert.equal(csesDifficulty(1068).level.key, 'easy');
  assert.equal(csesDifficulty(1194).level.key, 'medium');
  assert.equal(csesDifficulty(3191).level.key, 'hard'); // starred: 1,545 solvers, tripled
  assert.equal(csesDifficulty(2209).level.key, 'very-hard');
  assert.equal(csesDifficulty(1728).level.key, 'extreme');
  assert.match(csesDifficulty(1068).detail, /183,722/);
});

test('Codeforces ratings map onto the same five levels', () => {
  const key = (code) => cfDifficulty(code).level.key;
  assert.equal(key('4A'), 'easy'); // 800
  assert.equal(key('1352C'), 'easy'); // 1200
  assert.equal(key('4C'), 'medium'); // 1300
  assert.equal(key('1526C2'), 'medium'); // 1600
  assert.equal(key('466C'), 'hard'); // 1700
  assert.equal(key('578C'), 'hard'); // 2000
  assert.equal(key('1265E'), 'very-hard'); // 2100
  assert.equal(key('959F'), 'very-hard'); // 2400
  assert.equal(key('508D'), 'extreme'); // 2500
  assert.equal(cfDifficulty('nope'), null);
  assert.equal(LEVELS.length, 5);
});
