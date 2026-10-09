// Static content: the five-step loop, the topics and the 8-week plan.
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
// The built-in reader opens the handbook on the right page in every browser, phones included
// (many ignore #page=N on a plain PDF link).
export const READER_PATH = './book.html';

// Link to a book page (as printed in the handbook) in the reader. The PDF page is 10 later.
export function handbookUrl(bookPage) {
  return `${READER_PATH}#page=${bookPage + BOOK_PAGE_OFFSET}`;
}

// Past ICPC India contests (Kanpur, Amritapuri and others) with links for upsolving.
export const INDIA_CONTESTS_URL = 'https://codeforces.com/blog/entry/105000';

// `focus` says what to master; `chapter` and `page` are null for topics that are not in the book.
// Edge topics are optional: they never block a week's checklist.
function topic(id, week, priority, title, focus, { chapter = null, page = null, visualize = null, reference = null } = {}) {
  const practice = PRACTICE[id];
  if (!practice) throw new Error(`No practice problems for topic ${id}`);
  return { id, title, focus, chapter, page, week, priority, visualize, reference, practice, optional: priority === 'Edge' };
}

const VISUALGO = (name) => `https://visualgo.net/en/${name}`;
const CPA = (path) => `https://cp-algorithms.com/${path}.html`;

// Plan order. Weeks follow what ICPC Asia regionals ask most, and each week builds on the ones before.
export const TOPICS = [
  // Week 1: the techniques that show up in almost every problem set.
  topic('c1', 1, 'Core', 'Introduction, I/O and number handling',
    'Fast input and output, 64-bit overflow, modular arithmetic basics, floating-point care, and flushing output in interactive problems.',
    { chapter: 1, page: 3 }),
  topic('c2', 1, 'Core', 'Time complexity',
    'Turn the constraints into an operation budget (roughly 10⁸ simple operations per second) and pick an algorithm that fits it.',
    { chapter: 2, page: 17 }),
  topic('c3', 1, 'Core', 'Sorting and binary search, including on the answer',
    'Custom comparators, lower_bound and upper_bound, binary search on the answer with a monotone check, ternary search, and interactive binary search.',
    { chapter: 3, page: 25, visualize: VISUALGO('sorting'), reference: CPA('num_methods/binary_search') }),
  topic('c4', 1, 'Core', 'Data structures (STL)',
    'Choosing between vector, deque, set, multiset, map, priority_queue and bitset, plus the policy-based ordered set.',
    { chapter: 4, page: 35, visualize: VISUALGO('bst') }),
  topic('c9p', 1, 'Core', 'Prefix sums and difference arrays',
    '1D and 2D prefix sums, prefix XOR, difference arrays for range updates, and counting subarrays with a hash map of prefix values.',
    { chapter: 9, page: 84, reference: 'https://usaco.guide/silver/prefix-sums' }),
  topic('c8', 1, 'Core', 'Two pointers, monotonic stack, sliding window',
    'Two pointers over sorted data or windows, nearest smaller values with a stack, and the sliding-window minimum with a deque.',
    { chapter: 8, page: 77, reference: CPA('data_structures/stack_queue_modification') }),
  topic('c6', 1, 'Core', 'Greedy and constructive algorithms',
    'Proving greedy choices with exchange arguments, interval scheduling, and building an answer directly when a problem asks you to construct one.',
    { chapter: 6, page: 57 }),

  // Week 2: from brute force to DP, the most common hard-problem tool.
  topic('c5', 2, 'Core', 'Complete search and meet in the middle',
    'Generating subsets and permutations, backtracking with pruning, and splitting a search over 2ⁿ options into two halves.',
    { chapter: 5, page: 47, visualize: VISUALGO('recursion') }),
  topic('c7', 2, 'Core', 'Dynamic programming',
    'Designing states and transitions: coin problems, knapsack, LIS in O(n log n), edit distance, grid paths, and counting modulo a prime.',
    { chapter: 7, page: 65, visualize: VISUALGO('recursion'), reference: 'https://usaco.guide/gold/intro-dp' }),
  topic('g_int', 2, 'Common', 'Interval DP',
    'DP over ranges [l, r] built from smaller ranges: removal games, merging, and deleting or recolouring segments.',
    { visualize: VISUALGO('recursion'), reference: 'https://usaco.guide/gold/dp-ranges' }),
  topic('g_digit', 2, 'Common', 'Digit DP',
    'Counting numbers in [L, R] by placing digits from the most significant one while tracking whether the prefix is still tight.',
    { visualize: VISUALGO('recursion'), reference: 'https://usaco.guide/gold/digit-dp' }),
  topic('c10', 2, 'Core', 'Bit manipulation and bitmask DP',
    'Bit tricks and XOR properties, DP over subsets of up to about 20 items, and sum over subsets (SOS) DP.',
    { chapter: 10, page: 95, visualize: VISUALGO('bitmask'), reference: CPA('algebra/bit-manipulation') }),

  // Week 3: maths appears in most Indian regional sets, and later counting problems need it.
  topic('c21', 3, 'Core', 'Number theory',
    'Sieve and smallest prime factor, gcd and extended Euclid, fast power and modular inverse, Euler’s totient, and counting divisors.',
    { chapter: 21, page: 197, reference: CPA('algebra/sieve-of-eratosthenes') }),
  topic('c22', 3, 'Core', 'Combinatorics',
    'Binomial coefficients from factorials mod p, stars and bars, inclusion–exclusion, Catalan numbers, derangements and Burnside’s lemma.',
    { chapter: 22, page: 207, reference: CPA('combinatorics/binomial-coefficients') }),
  topic('c24', 3, 'Common', 'Probability and expected value',
    'Linearity of expectation, expected-value DP, and answers given as fractions modulo a prime.',
    { chapter: 24, page: 225 }),
  topic('c25', 3, 'Common', 'Game theory: Nim, Sprague–Grundy',
    'Winning and losing positions, Nim and its variants, and Grundy numbers for sums of independent games.',
    { chapter: 25, page: 235, reference: CPA('game_theory/sprague-grundy-nim') }),
  topic('g_xor', 3, 'Common', 'XOR basis',
    'A linear basis over GF(2): the maximum XOR of a subset, counting reachable XOR values, and keeping a basis for every prefix.',
    { reference: 'https://usaco.guide/adv/xor-basis' }),

  // Week 4: graph search and shortest paths.
  topic('c11', 4, 'Core', 'Basics of graphs',
    'Adjacency lists, edge lists and grids as graphs; degrees, paths, connectivity and trees.',
    { chapter: 11, page: 109, visualize: VISUALGO('graphds') }),
  topic('c12', 4, 'Core', 'DFS and BFS',
    'Connected components, cycle detection, bipartite checks, multi-source BFS and BFS on grids.',
    { chapter: 12, page: 117, visualize: VISUALGO('dfsbfs'), reference: CPA('graph/breadth-first-search') }),
  topic('c13', 4, 'Core', 'Shortest paths',
    'Dijkstra with a priority queue, 0-1 BFS, Bellman–Ford and negative cycles, Floyd–Warshall, and shortest paths over state graphs.',
    { chapter: 13, page: 123, visualize: VISUALGO('sssp'), reference: CPA('graph/dijkstra') }),
  topic('c15', 4, 'Core', 'Spanning trees and union-find',
    'Union-find with path compression and union by size, Kruskal’s algorithm, and answering connectivity questions offline.',
    { chapter: 15, page: 141, visualize: VISUALGO('mst'), reference: CPA('data_structures/disjoint_set_union') }),
  topic('c16', 4, 'Core', 'Directed graphs: toposort, DAG DP, successors',
    'Topological order with Kahn’s algorithm or DFS, DP over a DAG, cycle finding, and successor graphs with binary lifting.',
    { chapter: 16, page: 149, visualize: VISUALGO('dfsbfs'), reference: CPA('graph/topological-sort') }),

  // Week 5: trees and the data structures that answer queries on them.
  topic('c9', 5, 'Core', 'Range queries: Fenwick and segment tree',
    'Sparse table for static minimums, the Fenwick tree, a segment tree with point updates, and coordinate compression.',
    { chapter: 9, page: 86, visualize: VISUALGO('segmenttree'), reference: CPA('data_structures/segment_tree') }),
  topic('c28', 5, 'Core', 'Lazy propagation and segment tree variants',
    'Range updates with lazy propagation, nodes that store merged information (such as the best subarray), and persistent segment trees.',
    { chapter: 28, page: 257, visualize: VISUALGO('segmenttree'), reference: CPA('data_structures/segment_tree') }),
  topic('c14', 5, 'Core', 'Tree algorithms: subtree DP, diameter, rerooting',
    'Subtree sizes and DP on subtrees, the diameter of a tree, and rerooting to get an answer for every possible root.',
    { chapter: 14, page: 133 }),
  topic('c18', 5, 'Core', 'Tree queries: binary lifting, Euler tour, LCA',
    'k-th ancestors and LCA with binary lifting, distances between nodes, and Euler tour flattening for subtree and path queries.',
    { chapter: 18, page: 163, reference: CPA('graph/lca_binary_lifting') }),
  topic('c18m', 5, 'Common', 'Small-to-large merging',
    'Merging every child’s set into the largest one (DSU on tree) to answer subtree questions in O(n log n).',
    { chapter: 18, page: 170, reference: 'https://usaco.guide/plat/merging' }),

  // Week 6: string matching and deeper graph structure.
  topic('c26', 6, 'Core', 'Strings: trie, hashing, Z-algorithm',
    'Polynomial hashing with a large or double modulus, the Z-function, tries, and Manacher’s algorithm for palindromes.',
    { chapter: 26, page: 243, reference: CPA('string/string-hashing') }),
  topic('g_kmp', 6, 'Common', 'Prefix function (KMP)',
    'The prefix function for pattern matching, borders and periods, and the KMP automaton.',
    { reference: CPA('string/prefix-function') }),
  topic('g_sa', 6, 'Edge', 'Suffix array and LCP',
    'Building a suffix array in O(n log n), the LCP array, and counting or ordering distinct substrings.',
    { visualize: VISUALGO('suffixarray'), reference: CPA('string/suffix-array') }),
  topic('c17', 6, 'Common', 'Strong connectivity and 2-SAT',
    'Kosaraju’s or Tarjan’s algorithm, the condensation DAG, and 2-SAT through an implication graph.',
    { chapter: 17, page: 157, visualize: VISUALGO('dfsbfs'), reference: CPA('graph/strongly-connected-components') }),
  topic('g_brg', 6, 'Common', 'Bridges and articulation points',
    'Low-link values in a DFS tree to find bridges and cut vertices, and the bridge tree of 2-edge-connected components.',
    { visualize: VISUALGO('dfsbfs'), reference: CPA('graph/bridge-searching') }),
  topic('c19', 6, 'Common', 'Eulerian paths and De Bruijn sequences',
    'When an Eulerian path or circuit exists, and Hierholzer’s algorithm for directed and undirected graphs.',
    { chapter: 19, page: 173, reference: CPA('graph/euler_path') }),

  // Week 7: less frequent topics. Edge topics here are optional; do them if time allows.
  topic('c29', 7, 'Common', 'Geometry primitives',
    'Points with integer coordinates, cross products and orientation, segment intersection, polygon area, and floating-point care.',
    { chapter: 29, page: 265, visualize: VISUALGO('polygon'), reference: CPA('geometry/area-of-simple-polygon') }),
  topic('c30', 7, 'Common', 'Sweep line, closest pair, convex hull',
    'Event-based sweeps, the closest pair of points in O(n log n), and the monotone chain convex hull.',
    { chapter: 30, page: 275, visualize: VISUALGO('convexhull'), reference: CPA('geometry/convex-hull') }),
  topic('c20', 7, 'Common', 'Flows, cuts and matchings (learn Dinic too)',
    'Maximum flow with Dinic’s algorithm, minimum cuts, and bipartite matching with Kuhn’s algorithm or Hopcroft–Karp.',
    { chapter: 20, page: 181, visualize: VISUALGO('maxflow'), reference: CPA('graph/dinic') }),
  topic('c23', 7, 'Common', 'Matrices and linear recurrences',
    'Matrix multiplication and fast exponentiation for linear recurrences and for counting walks of length k.',
    { chapter: 23, page: 217, reference: CPA('algebra/binary-exp') }),
  topic('c27', 7, 'Common', "Square root algorithms and Mo's",
    "Splitting an array into √n blocks, and Mo’s algorithm for answering range queries offline.",
    { chapter: 27, page: 251, reference: CPA('data_structures/sqrt_decomposition') }),
  topic('g_mcmf', 7, 'Edge', 'Min-cost max-flow',
    'Successive shortest paths with Bellman–Ford or SPFA, and assignment problems.',
    { reference: CPA('graph/min_cost_flow') }),
  topic('g_hld', 7, 'Edge', 'Heavy-light decomposition',
    'Splitting a tree into heavy chains so that a path query becomes a few segment tree queries.',
    { reference: CPA('graph/hld') }),
  topic('g_cen', 7, 'Edge', 'Centroid decomposition',
    'Splitting a tree at centroids recursively to count or query paths in O(n log n).',
    { reference: 'https://usaco.guide/plat/centroid' }),
  topic('g_cht', 7, 'Edge', 'Convex hull trick and Li Chao tree',
    'Speeding up DP transitions of the form min(a·x + b) with a hull of lines or a Li Chao tree.',
    { reference: CPA('geometry/convex_hull_trick') }),
  topic('g_fft', 7, 'Edge', 'FFT and NTT',
    'Multiplying polynomials in O(n log n) for convolutions, counting sums, and fuzzy string matching.',
    { reference: CPA('algebra/fft') }),
];

// Topics are numbered 1, 2, 3… in plan order. (Chapter numbers no longer run in order, and two
// topics come from chapter 9 and two from chapter 18, so they can't serve as numbers.)
TOPICS.forEach((t, i) => { t.number = i + 1; });

export const TOTAL_STEPS = TOPICS.length * STEPS.length;

export const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

// Checklist items. `loop` is derived from topic progress; the rest are ticked by hand.
const ITEMS = {
  loop: { id: 'loop', derived: true },
  practice: { id: 'practice', label: "Solve the practice problems for this week's topics", hint: 'practice' },
  contests: { id: 'contests', label: 'Take part in 1 or 2 contests, then upsolve a problem you missed' },
  revisit: { id: 'revisit', label: 'Re-solve problems marked to revisit', hint: 'revisit' },
  stress: { id: 'stress', label: 'Write a stress test (a brute force, random inputs and a compare loop) and use it on one wrong answer' },
  mock: {
    id: 'mock',
    label: 'Do one full 5-hour virtual ICPC regional as a checkpoint, then upsolve it',
    link: { label: 'Find a past ICPC India set', url: INDIA_CONTESTS_URL },
  },
};

function learningWeek(n, title, summary, { extraItems = [], extras = [] } = {}) {
  const checklist = [ITEMS.loop, ITEMS.practice, ITEMS.contests, ITEMS.revisit, ...extraItems.map((k) => ITEMS[k])];
  return { n, title, summary, extras, checklist };
}

export const WEEKS = [
  learningWeek(1, 'Foundations', 'Chapters 1–4, 6 and 8, plus prefix sums from chapter 9.', { extraItems: ['stress'] }),
  learningWeek(2, 'Complete search and dynamic programming',
    'Chapters 5, 7 and 10, plus interval and digit DP from the USACO Guide.'),
  learningWeek(3, 'Mathematics', 'Chapters 21, 22, 24 and 25, plus XOR basis.'),
  learningWeek(4, 'Graphs', 'Chapters 11–13, 15 and 16. Ends with your first full mock contest.', { extraItems: ['mock'] }),
  learningWeek(5, 'Trees and range queries', 'Chapters 9, 14, 18 and 28.'),
  learningWeek(6, 'Strings and graph connectivity',
    'Chapters 17, 19 and 26, plus KMP and bridges. Suffix arrays are optional. Ends with a second mock contest.',
    { extraItems: ['mock'] }),
  learningWeek(7, 'Geometry, flows and advanced topics',
    'Chapters 20, 23, 27, 29 and 30. Min-cost flow, HLD, centroid decomposition, CHT and FFT are optional.'),
  {
    n: 8,
    title: 'Contest mode and revision',
    summary: 'No new topics. Full virtual contests, team practice, upsolving and revision.',
    extras: [
      { label: 'Codeforces Gym (more past regionals)', url: GYM_URL },
      { label: 'A recent Kanpur regional and its replay round', url: 'https://codeforces.com/blog/entry/149435' },
    ],
    checklist: [
      {
        id: 'virtuals',
        label: 'Do 3–4 full 5-hour virtual ICPC regionals, including past Kanpur and Amritapuri sets',
        link: { label: 'Find past ICPC India sets', url: INDIA_CONTESTS_URL },
      },
      { id: 'team', label: 'Do at least one of them with your teammates: three people, one computer' },
      { id: 'upsolve', label: 'Upsolve at least one missed problem per contest' },
      { id: 'clear', label: "Clear the 'to revisit' list", hint: 'revisit' },
      { id: 'patterns', label: 'Review your mistake patterns', hint: 'patterns' },
      { id: 'routine', label: 'Settle your contest routine: read every problem early, follow the scoreboard, and stress-test before resubmitting' },
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
