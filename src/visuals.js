// Ways to see each topic before coding it: interactive pages that animate the algorithm step by
// step, and videos from creators who teach that topic well. A topic with nothing good enough
// has an empty list rather than a generic search.

const interactive = (label, url) => ({ label, url, video: false });

const visualgo = (slug, what) => interactive(`VisuAlgo: ${what}`, `https://visualgo.net/en/${slug}`);
const usfca = (page, what) => interactive(`USFCA: ${what}`, `https://www.cs.usfca.edu/~galles/visualization/${page}.html`);
const GRAPH_EDITOR = interactive('CS Academy graph editor: draw your own test cases', 'https://csacademy.com/app/graph_editor/');
const RED_BLOB_PATHS = interactive('Red Blob Games: BFS and Dijkstra, animated', 'https://www.redblobgames.com/pathfinding/a-star/introduction.html');

// A search inside one creator's channel, so it lists only their videos on the topic.
const CHANNELS = {
  'William Fiset': 'https://www.youtube.com/@WilliamFiset-videos',
  Reducible: 'https://www.youtube.com/@Reducible',
  Errichto: 'https://www.youtube.com/@errichto',
  'Abdul Bari': 'https://www.youtube.com/channel/UCZCFT11CWBi3MHNlGf019nw',
};
const videos = (creator, query) => ({
  label: `${creator}: ${query}`,
  url: `${CHANNELS[creator]}/search?query=${encodeURIComponent(query)}`,
  video: true,
});
const video = (label, id) => ({ label, url: `https://www.youtube.com/watch?v=${id}`, video: true });

export const VISUALS = {
  c1: [],
  c2: [videos('Abdul Bari', 'time complexity')],
  c3: [visualgo('sorting', 'sorting'), usfca('Search', 'binary search'), videos('Errichto', 'binary search')],
  c4: [
    visualgo('bst', 'balanced BSTs (set, map)'),
    visualgo('heap', 'binary heap (priority_queue)'),
    visualgo('hashtable', 'hash tables (unordered_map)'),
    visualgo('list', 'stack, queue and deque'),
  ],
  c9p: [],
  c8: [],
  c6: [videos('Abdul Bari', 'greedy method')],

  c5: [
    visualgo('recursion', 'recursion tree'),
    usfca('RecQueens', 'N-queens backtracking'),
    videos('Reducible', 'recursion'),
    videos('Abdul Bari', 'backtracking'),
  ],
  c7: [
    visualgo('recursion', 'recursion tree and repeated subproblems'),
    usfca('DPChange', 'coin change table'),
    usfca('DPLCS', 'longest common subsequence table'),
    videos('Reducible', 'dynamic programming'),
    videos('Errichto', 'dynamic programming'),
  ],
  g_int: [visualgo('recursion', 'recursion tree over ranges')],
  g_digit: [visualgo('recursion', 'recursion tree')],
  c10: [visualgo('bitmask', 'bitmask operations'), videos('Errichto', 'bitwise operations'), videos('William Fiset', 'traveling salesman')],

  c21: [
    interactive('Wikipedia: animated sieve of Eratosthenes', 'https://en.wikipedia.org/wiki/Sieve_of_Eratosthenes'),
    interactive('Wikipedia: animated Euclidean algorithm', 'https://en.wikipedia.org/wiki/Euclidean_algorithm'),
  ],
  c22: [],
  c24: [interactive('Seeing Theory: probability and expectation, interactive', 'https://seeing-theory.brown.edu/basic-probability/index.html')],
  c25: [],
  g_xor: [],

  c11: [
    visualgo('graphds', 'graph representations'),
    interactive('Red Blob Games: grids as graphs', 'https://www.redblobgames.com/pathfinding/grids/graphs.html'),
    GRAPH_EDITOR,
    videos('William Fiset', 'graph theory introduction'),
  ],
  c12: [
    visualgo('dfsbfs', 'DFS and BFS'),
    RED_BLOB_PATHS,
    usfca('BFS', 'BFS'),
    usfca('DFS', 'DFS'),
    videos('Reducible', 'breadth first search'),
    videos('William Fiset', 'breadth first search'),
  ],
  c13: [
    visualgo('sssp', 'Dijkstra and Bellman–Ford'),
    usfca('Dijkstra', 'Dijkstra'),
    usfca('Floyd', 'Floyd–Warshall'),
    RED_BLOB_PATHS,
    videos('William Fiset', 'shortest path'),
  ],
  c15: [
    visualgo('mst', 'Kruskal and Prim'),
    visualgo('ufds', 'union-find'),
    usfca('Kruskal', 'Kruskal'),
    usfca('DisjointSets', 'union-find with path compression'),
    videos('William Fiset', 'union find'),
  ],
  c16: [
    visualgo('dfsbfs', 'topological sort'),
    usfca('TopoSortIndegree', "topological sort (Kahn's algorithm)"),
    visualgo('cyclefinding', 'cycle finding in a successor graph'),
    videos('William Fiset', 'topological sort'),
  ],

  c9: [
    visualgo('segmenttree', 'segment tree'),
    visualgo('fenwicktree', 'Fenwick tree'),
    videos('William Fiset', 'fenwick tree'),
    videos('William Fiset', 'sparse table'),
  ],
  c28: [visualgo('segmenttree', 'segment tree updates')],
  c14: [GRAPH_EDITOR, videos('William Fiset', 'tree algorithms')],
  c18: [GRAPH_EDITOR, videos('William Fiset', 'lowest common ancestor')],
  c18m: [GRAPH_EDITOR],

  c26: [usfca('Trie', 'trie')],
  g_kmp: [videos('Abdul Bari', 'KMP')],
  g_sa: [visualgo('suffixarray', 'suffix array and LCP'), visualgo('suffixtree', 'suffix tree'), videos('William Fiset', 'suffix array')],
  c17: [
    visualgo('dfsbfs', 'SCCs and 2-SAT'),
    usfca('ConnectedComponent', "strongly connected components (Kosaraju's algorithm)"),
    videos('William Fiset', 'strongly connected components'),
  ],
  g_brg: [visualgo('dfsbfs', 'bridges and articulation points'), videos('William Fiset', 'bridges articulation points')],
  c19: [videos('William Fiset', 'eulerian path')],

  c29: [visualgo('polygon', 'polygons, area and point in polygon')],
  c30: [visualgo('convexhull', 'convex hull')],
  c20: [visualgo('maxflow', 'max flow (Ford–Fulkerson, Dinic)'), visualgo('matching', 'bipartite matching'), videos('William Fiset', 'network flow')],
  c23: [{ label: '3Blue1Brown: matrix multiplication as composition', url: 'https://www.3blue1brown.com/lessons/matrix-multiplication', video: true }],
  c27: [],
  g_mcmf: [],
  g_hld: [],
  g_cen: [],
  g_cht: [],
  g_fft: [
    video('Reducible: the Fast Fourier Transform', 'h7apO7q16V0'),
    interactive('Jez Swanson: an interactive introduction to Fourier transforms', 'https://www.jezzamon.com/fourier/'),
  ],
};
