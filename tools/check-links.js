// Checks every external link in src/data.js and src/practice.js with a real HTTP request.
// Run from the project root: node tools/check-links.js   (Node 18 or newer)

import { TOPICS, WEEKS, GYM_URL } from '../src/data.js';
import { csesUrl, codeforcesUrl } from '../src/practice.js';

const urls = new Set([GYM_URL, 'https://www.youtube.com/results?search_query=greedy+algorithms+algorithm+visualization']);
for (const t of TOPICS) {
  if (t.visualize) urls.add(t.visualize);
  if (t.reference) urls.add(t.reference);
  for (const [id] of t.practice.cses) urls.add(csesUrl(id));
  for (const [code] of t.practice.cf) urls.add(codeforcesUrl(code));
}
for (const w of WEEKS) {
  for (const x of w.extras) urls.add(x.url);
  for (const item of w.checklist) if (item.link) urls.add(item.link.url);
}

async function check(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
      headers: { 'user-agent': 'Mozilla/5.0 (balloon-room link check)' },
    });
    return { url, status: res.status, ok: res.ok };
  } catch (err) {
    return { url, status: err.cause?.code || err.name, ok: false };
  }
}

// A few requests at a time, so CSES and Codeforces don't rate-limit the check.
const queue = [...urls];
const results = [];
async function worker() {
  while (queue.length) {
    const url = queue.shift();
    results.push(await check(url));
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

results.sort((a, b) => a.url.localeCompare(b.url));
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.status}  ${r.url}`);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} links OK`);
if (failed.length) process.exitCode = 1;
