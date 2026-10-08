// Exact practice problems for each topic: CSES task ids and Codeforces problem codes.
// Each id/name pair was checked against the problem's own page.

const P = (cses, cf) => ({ cses, cf });

export const PRACTICE = {
  c1: P(
    [[1068, 'Weird Algorithm'], [1083, 'Missing Number'], [1069, 'Repetitions'], [1094, 'Increasing Array']],
    [['1A', 'Theatre Square'], ['4A', 'Watermelon'], ['71A', 'Way Too Long Words']],
  ),
  c2: P(
    [[1643, 'Maximum Subarray Sum'], [1071, 'Number Spiral'], [1072, 'Two Knights'], [1618, 'Trailing Zeros']],
    [['1352C', 'K-th Not Divisible by n'], ['466C', 'Number of Ways'], ['577B', 'Modulo Sum']],
  ),
  c3: P(
    [[1621, 'Distinct Numbers'], [1084, 'Apartments'], [1090, 'Ferris Wheel'], [1620, 'Factory Machines']],
    [['706B', 'Interesting drink'], ['474B', 'Worms'], ['1201C', 'Maximum Median']],
  ),
  c4: P(
    [[1091, 'Concert Tickets'], [1163, 'Traffic Lights'], [1141, 'Playlist'], [1164, 'Room Allocation']],
    [['4C', 'Registration system'], ['368B', 'Sereja and Suffixes'], ['1526C2', 'Potions (Hard Version)']],
  ),
  c5: P(
    [[1623, 'Apple Division'], [1624, 'Chessboard and Queens'], [1622, 'Creating Strings'], [1628, 'Meet in the Middle']],
    [['550B', 'Preparing Olympiad'], ['1097B', 'Petr and a Combination Lock'], ['888E', 'Maximum Subsequence']],
  ),
  c6: P(
    [[1629, 'Movie Festival'], [1074, 'Stick Lengths'], [2183, 'Missing Coin Sum'], [1630, 'Tasks and Deadlines']],
    [['545C', 'Woodcutters'], ['489B', 'BerSU Ball'], ['1197C', 'Array Splitting']],
  ),
  c8: P(
    [[1640, 'Sum of Two Values'], [1645, 'Nearest Smaller Values'], [2428, 'Distinct Values Subarrays II'], [1076, 'Sliding Window Median']],
    [['279B', 'Books'], ['547B', 'Mike and Feet'], ['602B', 'Approximating a Constant Range']],
  ),
  c7: P(
    [[1633, 'Dice Combinations'], [1634, 'Minimizing Coins'], [1158, 'Book Shop'], [1639, 'Edit Distance'],
      [1145, 'Increasing Subsequence'], [1097, 'Removal Game'], [2220, 'Counting Numbers']],
    [['455A', 'Boredom'], ['189A', 'Cut Ribbon'], ['1195C', 'Basketball Exercise'], ['607B', 'Zuma']],
  ),
  c9: P(
    [[1646, 'Static Range Sum Queries'], [1647, 'Static Range Minimum Queries'], [1648, 'Dynamic Range Sum Queries'],
      [1649, 'Dynamic Range Minimum Queries'], [1143, 'Hotel Queries']],
    [['339D', 'Xenia and Bit Operations'], ['61E', 'Enemy is weak'], ['380C', 'Sereja and Brackets']],
  ),
  c10: P(
    [[1653, 'Elevator Rides'], [2181, 'Counting Tilings'], [1690, 'Hamiltonian Flights']],
    [['579A', 'Raising Bacteria'], ['580D', 'Kefa and Dishes'], ['16E', 'Fish'], ['165E', 'Compatible Numbers']],
  ),
  c11: P(
    [[1192, 'Counting Rooms'], [1666, 'Building Roads']],
    [['115A', 'Party'], ['500A', 'New Year Transportation'], ['977E', 'Cyclic Components']],
  ),
  c12: P(
    [[1193, 'Labyrinth'], [1667, 'Message Route'], [1668, 'Building Teams'], [1669, 'Round Trip'], [1194, 'Monsters']],
    [['520B', 'Two Buttons'], ['377A', 'Maze'], ['1063B', 'Labyrinth']],
  ),
  c13: P(
    [[1671, 'Shortest Routes I'], [1672, 'Shortest Routes II'], [1673, 'High Score'], [1195, 'Flight Discount'], [1197, 'Cycle Finding']],
    [['20C', 'Dijkstra?'], ['295B', 'Greg and Graph'], ['545E', 'Paths and Trees']],
  ),
  c15: P(
    [[1675, 'Road Reparation'], [1676, 'Road Construction']],
    [['25D', 'Roads not only in Berland'], ['277A', 'Learning Languages'], ['1245D', 'Shichikuji and Power Grid'],
      ['609E', 'Minimum spanning tree for each edge']],
  ),
  c16: P(
    [[1679, 'Course Schedule'], [1680, 'Longest Flight Route'], [1681, 'Game Routes'], [1750, 'Planets Queries I'], [1751, 'Planets Cycles']],
    [['510C', 'Fox And Names'], ['919D', 'Substring'], ['1020B', 'Badge']],
  ),
  c14: P(
    [[1130, 'Tree Matching'], [1131, 'Tree Diameter'], [1132, 'Tree Distances I'], [1133, 'Tree Distances II']],
    [['1092F', 'Tree with Maximum Cost'], ['1187E', 'Tree Painting'], ['1083A', 'The Fair Nut and the Best Path']],
  ),
  c18: P(
    [[1687, 'Company Queries I'], [1688, 'Company Queries II'], [1135, 'Distance Queries'], [1137, 'Subtree Queries'], [1138, 'Path Queries']],
    [['1328E', 'Tree Queries'], ['191C', 'Fools and Roads'], ['620E', 'New Year Tree']],
  ),
  c17: P(
    [[1682, 'Flight Routes Check'], [1683, 'Planets and Kingdoms'], [1686, 'Coin Collector'], [1684, 'Giant Pizza']],
    [['427C', 'Checkposts'], ['776D', 'The Door Problem'], ['228E', 'The Road to Berland is Paved With Good Intentions']],
  ),
  c19: P(
    [[1691, 'Mail Delivery'], [1693, 'Teleporters Path'], [1692, 'De Bruijn Sequence']],
    [['508D', 'Tanya and Password'], ['723E', 'One-Way Reform'], ['1361C', "Johnny and Megan's Necklace"]],
  ),
  c20: P(
    [[1694, 'Download Speed'], [1696, 'School Dance'], [1711, 'Distinct Routes']],
    [['653D', 'Delivery Bears'], ['498C', 'Array and Operations'], ['1139E', 'Maximize Mex']],
  ),
  g_mcmf: P(
    [[2129, 'Task Assignment'], [2130, 'Distinct Routes II'], [2121, 'Parcel Delivery']],
    [['237E', 'Build String'], ['863F', 'Almost Permutation'], ['277E', 'Binary Tree on Plane']],
  ),
  c21: P(
    [[1712, 'Exponentiation II'], [1713, 'Counting Divisors'], [1081, 'Common Divisors'], [2182, 'Divisor Analysis'], [2185, 'Prime Multiples']],
    [['230B', 'T-primes'], ['26A', 'Almost Prime'], ['1366D', 'Two Divisors']],
  ),
  c22: P(
    [[1079, 'Binomial Coefficients'], [1715, 'Creating Strings II'], [1716, 'Distributing Apples'], [1717, 'Christmas Party'],
      [2064, 'Bracket Sequences I']],
    [['300C', 'Beautiful Numbers'], ['1288C', 'Two Arrays'], ['1312D', 'Count the Arrays']],
  ),
  c23: P(
    [[1096, 'Throwing Dice'], [1723, 'Graph Paths I'], [1724, 'Graph Paths II']],
    [['185A', 'Plant'], ['450B', 'Jzzhu and Sequences'], ['1182E', 'Product Oriented Recurrence']],
  ),
  c24: P(
    [[1725, 'Dice Probability'], [1726, 'Moving Robots'], [1727, 'Candy Lottery'], [1728, 'Inversion Probability']],
    [['148D', 'Bag of mice'], ['518D', 'Ilya and Escalator'], ['453A', 'Little Pony and Expected Maximum'], ['280C', 'Game on Tree']],
  ),
  c25: P(
    [[1729, 'Stick Game'], [1730, 'Nim Game I'], [1098, 'Nim Game II'], [1099, 'Stair Game'], [2207, "Grundy's Game"]],
    [['1194D', '1-2-K Game'], ['768E', 'Game of Stones'], ['603C', 'Lieges of Legendre']],
  ),
  c26: P(
    [[1731, 'Word Combinations'], [1733, 'Finding Periods'], [1110, 'Minimal Rotation'], [2420, 'Palindrome Queries']],
    [['126B', 'Password'], ['271D', 'Good Substrings'], ['706D', "Vasiliy's Multiset"]],
  ),
  g_kmp: P(
    [[1753, 'String Matching'], [1732, 'Finding Borders'], [1112, 'Required Substring']],
    [['432D', 'Prefixes and Suffixes'], ['1200E', 'Compress Words'], ['535D', 'Tavas and Malekas']],
  ),
  g_sa: P(
    [[2102, 'Finding Patterns'], [2105, 'Distinct Substrings'], [2106, 'Repeating Substring'], [2108, 'Substring Order I']],
    [['427D', 'Match & Catch'], ['123D', 'String'], ['873F', 'Forbidden Indices']],
  ),
  c28: P(
    [[1735, 'Range Updates and Sums'], [1736, 'Polynomial Queries'], [1737, 'Range Queries and Copies'], [1190, 'Subarray Sum Queries']],
    [['52C', 'Circular RMQ'], ['145E', 'Lucky Queries'], ['707D', 'Persistent Bookcase'], ['813E', 'Army Creation']],
  ),
  c27: P(
    [[1734, 'Distinct Values Queries']],
    [['13E', 'Holes'], ['86D', 'Powerful array'], ['617E', 'XOR and Favorite Number'], ['220B', 'Little Elephant and Array']],
  ),
  c29: P(
    [[2189, 'Point Location Test'], [2190, 'Line Segment Intersection'], [2191, 'Polygon Area'], [2192, 'Point in Polygon'],
      [2193, 'Polygon Lattice Points']],
    [['1C', 'Ancient Berland Circus'], ['598C', 'Nearest vectors'], ['659D', 'Bicycle Race']],
  ),
  c30: P(
    [[2194, 'Minimum Euclidean Distance'], [2195, 'Convex Hull'], [1741, 'Area of Rectangles'], [1740, 'Intersection Points']],
    [['429D', 'Tricky Function'], ['166B', 'Polygons'], ['1142C', 'U2'], ['610D', 'Vika and Segments']],
  ),
  g_hld: P(
    [[2134, 'Path Queries II']],
    [['343D', 'Water Tree'], ['165D', 'Beard Graph'], ['1174F', 'Ehab and the Big Finale']],
  ),
  g_cen: P(
    [[2079, 'Finding a Centroid'], [2080, 'Fixed-Length Paths I'], [2081, 'Fixed-Length Paths II']],
    [['342E', 'Xenia and Tree'], ['321C', 'Ciel the Commander'], ['161D', 'Distance in Tree']],
  ),
  g_cht: P(
    [[2084, 'Monster Game I'], [2085, 'Monster Game II'], [2086, 'Subarray Squares']],
    [['319C', 'Kalila and Dimna in the Logging Industry'], ['631E', 'Product Sum'], ['1083E', 'The Fair Nut and Rectangles'],
      ['932F', 'Escape Through Leaf']],
  ),
  g_fft: P(
    [[2111, 'Apples and Bananas'], [2112, 'One Bit Positions'], [2113, 'Signal Processing']],
    [['528D', 'Fuzzy Search'], ['993E', 'Nikita and Order Statistics'], ['954I', 'Yet Another String Matching Problem']],
  ),
};

export function csesUrl(id) {
  return `https://cses.fi/problemset/task/${id}`;
}

// '1526C2' → https://codeforces.com/problemset/problem/1526/C2
export function codeforcesUrl(code) {
  const m = /^(\d+)([A-Z]\d?)$/.exec(code);
  if (!m) throw new Error(`Bad Codeforces problem code: ${code}`);
  return `https://codeforces.com/problemset/problem/${m[1]}/${m[2]}`;
}
