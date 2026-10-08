// Checks every external link in src/data.js with a real HTTP request.
// Run from the project root: node tools/check-links.js   (Node 18 or newer)

import { TOPICS, WEEKS, CSES_URL, GYM_URL } from '../src/data.js';

const urls = new Set([CSES_URL, GYM_URL, 'https://www.youtube.com/results?search_query=greedy+algorithms+algorithm+visualization']);
for (const t of TOPICS) {
  if (t.visualize) urls.add(t.visualize);
  if (t.reference) urls.add(t.reference);
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

const results = await Promise.all([...urls].map(check));
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.status}  ${r.url}`);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} links OK`);
if (failed.length) process.exitCode = 1;
