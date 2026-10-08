// Static content: the five-step loop, the 37 topics and the 8-week plan.
// Nothing in here is ever written to storage.

import { PRACTICE } from './practice.js';

export const STEPS = [
  { key: 'read', label: 'Read' },
  { key: 'visual', label: 'Visualize' },
  { key: 'code', label: 'Code from memory' },
  { key: 'practice', label: 'Practice' },
  { key: 'revise', label: 'Revise' },
];

export const PRIORITIES = ['Core', 'Common', 'Edge'];

export const GYM_URL = 'https://codeforces.com/gym';

// The PDF has 10 front-matter pages before book page 1.
export const BOOK_PAGE_OFFSET = 10;
export const BOOK_PATH = './CP_book.pdf';

function topic(id, title, chapter, page, week, priority, visualize, reference, extra = {}) {
  const practice = PRACTICE[id];
  if (!practice) throw new Error(`No practice problems for topic ${id}`);
  return { id, title, chapter, page, week, priority, visualize, reference, practice, optional: false, ...extra };
}

const OPTIONAL = { optional: true };

// Plan order. `chapter` and `page` are null for topics that are not in the book.
export const TOPICS = [
  topic('c1', 'Introduction, I/O and number handling', 1, 3, 1, 'Core', null, null),
  topic('c2', 'Time complexity', 2, 17, 1, 'Core', null, null),
  topic('c3', 'Sorting and binary search', 3, 25, 1, 'Core',
    'https://visualgo.net/en/sorting', 'https://cp-algorithms.com/num_methods/binary_search.html'),
  topic('c4', 'Data structures (STL)', 4, 35, 1, 'Core',
    'https://visualgo.net/en/bst', null),
  topic('c5', 'Complete search and meet in the middle', 5, 47, 1, 'Core',
    'https://visualgo.net/en/recursion', null),
  topic('c6', 'Greedy algorithms', 6, 57, 1, 'Core', null, null),
  topic('c8', 'Two pointers, nearest smaller, sliding window', 8, 77, 1, 'Core',
    null, 'https://cp-algorithms.com/data_structures/stack_queue_modification.html'),

  topic('c7', 'Dynamic programming', 7, 65, 2, 'Core',
    'https://visualgo.net/en/recursion', 'https://usaco.guide/gold/intro-dp'),
  topic('c9', 'Range queries: Fenwick and segment tree', 9, 83, 2, 'Core',
    'https://visualgo.net/en/segmenttree', 'https://cp-algorithms.com/data_structures/segment_tree.html'),
  topic('c10', 'Bit manipulation and bitmask DP', 10, 95, 2, 'Common',
    'https://visualgo.net/en/bitmask', 'https://cp-algorithms.com/algebra/bit-manipulation.html'),

  topic('c11', 'Basics of graphs', 11, 109, 3, 'Core',
    'https://visualgo.net/en/graphds', null),
  topic('c12', 'DFS and BFS', 12, 117, 3, 'Core',
    'https://visualgo.net/en/dfsbfs', 'https://cp-algorithms.com/graph/breadth-first-search.html'),
  topic('c13', 'Shortest paths', 13, 123, 3, 'Core',
    'https://visualgo.net/en/sssp', 'https://cp-algorithms.com/graph/dijkstra.html'),
  topic('c15', 'Spanning trees and union-find', 15, 141, 3, 'Core',
    'https://visualgo.net/en/mst', 'https://cp-algorithms.com/data_structures/disjoint_set_union.html'),
  topic('c16', 'Directed graphs: toposort, DAG DP, successors', 16, 149, 3, 'Core',
    'https://visualgo.net/en/dfsbfs', 'https://cp-algorithms.com/graph/topological-sort.html'),

  topic('c14', 'Tree algorithms: subtree DP, diameter, rerooting', 14, 133, 4, 'Core', null, null),
  topic('c18', 'Tree queries: binary lifting, Euler tour, LCA', 18, 163, 4, 'Common',
    null, 'https://cp-algorithms.com/graph/lca_binary_lifting.html'),
  topic('c17', 'Strong connectivity and 2-SAT', 17, 157, 4, 'Common',
    'https://visualgo.net/en/dfsbfs', 'https://cp-algorithms.com/graph/strongly-connected-components.html'),
  topic('c19', 'Eulerian paths and De Bruijn sequences', 19, 173, 4, 'Common',
    null, 'https://cp-algorithms.com/graph/euler_path.html'),
  topic('c20', 'Flows, cuts and matchings (learn Dinic too)', 20, 181, 4, 'Common',
    'https://visualgo.net/en/maxflow', 'https://cp-algorithms.com/graph/dinic.html'),
  topic('g_mcmf', 'Min-cost max-flow', null, null, 4, 'Edge',
    null, 'https://cp-algorithms.com/graph/min_cost_flow.html'),

  topic('c21', 'Number theory', 21, 197, 5, 'Core',
    null, 'https://cp-algorithms.com/algebra/sieve-of-eratosthenes.html'),
  topic('c22', 'Combinatorics', 22, 207, 5, 'Core',
    null, 'https://cp-algorithms.com/combinatorics/binomial-coefficients.html'),
  topic('c23', 'Matrices and linear recurrences', 23, 217, 5, 'Common',
    null, 'https://cp-algorithms.com/algebra/binary-exp.html'),
  topic('c24', 'Probability and expected value', 24, 225, 5, 'Common', null, null),
  topic('c25', 'Game theory: Nim, Sprague–Grundy', 25, 235, 5, 'Common',
    null, 'https://cp-algorithms.com/game_theory/sprague-grundy-nim.html'),

  topic('c26', 'Strings: trie, hashing, Z-algorithm', 26, 243, 6, 'Core',
    null, 'https://cp-algorithms.com/string/string-hashing.html'),
  topic('g_kmp', 'Prefix function (KMP)', null, null, 6, 'Common',
    null, 'https://cp-algorithms.com/string/prefix-function.html'),
  topic('g_sa', 'Suffix array and LCP', null, null, 6, 'Edge',
    'https://visualgo.net/en/suffixarray', 'https://cp-algorithms.com/string/suffix-array.html'),
  topic('c28', 'Segment trees revisited: lazy, persistent', 28, 257, 6, 'Common',
    'https://visualgo.net/en/segmenttree', 'https://cp-algorithms.com/data_structures/segment_tree.html'),
  topic('c27', "Square root algorithms and Mo's", 27, 251, 6, 'Common',
    null, 'https://cp-algorithms.com/data_structures/sqrt_decomposition.html'),

  topic('c29', 'Geometry primitives', 29, 265, 7, 'Common',
    'https://visualgo.net/en/polygon', 'https://cp-algorithms.com/geometry/area-of-simple-polygon.html'),
  topic('c30', 'Sweep line, closest pair, convex hull', 30, 275, 7, 'Common',
    'https://visualgo.net/en/convexhull', 'https://cp-algorithms.com/geometry/convex-hull.html'),
  topic('g_hld', 'Heavy-light decomposition', null, null, 7, 'Edge',
    null, 'https://cp-algorithms.com/graph/hld.html', OPTIONAL),
  topic('g_cen', 'Centroid decomposition', null, null, 7, 'Edge',
    null, 'https://usaco.guide/plat/centroid', OPTIONAL),
  topic('g_cht', 'Convex hull trick and Li Chao tree', null, null, 7, 'Edge',
    null, 'https://cp-algorithms.com/geometry/convex_hull_trick.html', OPTIONAL),
  topic('g_fft', 'FFT and NTT', null, null, 7, 'Edge',
    null, 'https://cp-algorithms.com/algebra/fft.html', OPTIONAL),
];

export const TOTAL_STEPS = TOPICS.length * STEPS.length;

export const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

// Checklist items for weeks 1-7. `loop` is derived from topic progress; the rest are manual.
function learningChecklist() {
  return [
    { id: 'loop', derived: true },
    { id: 'practice', label: "Solve the practice problems for this week's topics", hint: 'practice' },
    { id: 'contests', label: 'Take part in 1 or 2 contests' },
    { id: 'revisit', label: 'Re-solve problems marked to revisit', hint: 'revisit' },
  ];
}

function learningWeek(n, title, summary, extra = {}) {
  return { n, title, summary, extras: [], checklist: learningChecklist(), ...extra };
}

export const WEEKS = [
  learningWeek(1, 'Foundations', 'Chapters 1–6 and 8.'),
  learningWeek(2, 'Dynamic programming and range queries',
    'Chapters 7, 9 and 10, plus interval and digit DP from the USACO Guide.', {
      extras: [
        { label: 'USACO Guide: range (interval) DP', url: 'https://usaco.guide/gold/dp-ranges' },
        { label: 'USACO Guide: digit DP', url: 'https://usaco.guide/gold/digit-dp' },
      ],
    }),
  learningWeek(3, 'Graphs I', 'Chapters 11–13, 15 and 16.'),
  learningWeek(4, 'Trees, connectivity and flows', 'Chapters 14 and 17–20, plus min-cost flow.'),
  learningWeek(5, 'Mathematics', 'Chapters 21–25.'),
  learningWeek(6, 'Strings and advanced data structures', 'Chapters 26–28, plus KMP and suffix arrays.'),
  learningWeek(7, 'Geometry and advanced techniques',
    'Chapters 29–30, plus HLD, centroid decomposition, CHT and FFT. The Edge topics are optional.'),
  {
    n: 8,
    title: 'Contest mode and revision',
    summary: 'No new topics. Full virtual contests, upsolving and revision.',
    extras: [],
    checklist: [
      {
        id: 'virtuals',
        label: 'Do 3–4 full 5-hour virtual ICPC regionals from the Codeforces Gym, including Asia sets such as Kanpur or Amritapuri',
        link: { label: 'Open the Codeforces Gym', url: GYM_URL },
      },
      { id: 'upsolve', label: 'Upsolve at least one missed problem per contest' },
      { id: 'clear', label: "Clear the 'to revisit' list", hint: 'revisit' },
      { id: 'patterns', label: 'Review your mistake patterns', hint: 'patterns' },
    ],
  },
];

export const WEEK_BY_NUMBER = Object.fromEntries(WEEKS.map((w) => [w.n, w]));

export function topicsForWeek(n) {
  return TOPICS.filter((t) => t.week === n);
}

export const RESULTS = [
  { id: 'alone', label: 'Solved alone' },
  { id: 'hint', label: 'Solved after a hint' },
  { id: 'editorial', label: 'Needed the editorial' },
  { id: 'unsolved', label: 'Not solved yet' },
];

export const MISTAKES = [
  { id: 'idea', label: 'Missing idea' },
  { id: 'bug', label: 'Implementation bug' },
  { id: 'edge', label: 'Edge case' },
  { id: 'limits', label: 'Time or memory limit' },
  { id: 'misread', label: 'Misread the statement' },
  { id: 'none', label: 'None' },
];

export const DEFAULT_RESULT = 'hint';
export const DEFAULT_MISTAKE = 'idea';

export function labelFor(list, id) {
  const item = list.find((x) => x.id === id);
  return item ? item.label : '';
}
