import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer } from '../server/serve.js';
import { createSync, normalizeServer, endpointFor, SYNC_STORAGE_KEY, SEND_DELAY, RETRY_DELAYS } from '../src/sync.js';
import { createStore, setStep, setNotes, setTheme, addProblem, syncedData, STORAGE_KEY } from '../src/store.js';

const KEY = 'sync-test-key-0123456789abcdef';
const PAGE = 'http://app.test/';
const quiet = { error() {} };

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    map,
  };
}

// Timers the test runs by hand.
function manualTimers() {
  let nextId = 1;
  const pending = new Map();
  return {
    setTimer(fn, ms) {
      const id = nextId++;
      pending.set(id, { fn, ms });
      return id;
    },
    clearTimer(id) { pending.delete(id); },
    delays: () => [...pending.values()].map((t) => t.ms),
    runAll() {
      const due = [...pending.values()];
      pending.clear();
      for (const t of due) t.fn();
    },
    count: () => pending.size,
  };
}

// One backend at a time; tests can swap in a fresh one (a wiped database) or take it offline.
const backend = { url: null, offline: false, calls: [], delay: null };
async function routedFetch(url, options) {
  backend.calls.push({ url, ...options });
  if (backend.offline) throw new TypeError('Failed to fetch');
  if (backend.delay) await backend.delay();
  const target = url.replace(/^http:\/\/app\.test/, backend.url).replace(/^https:\/\/elsewhere\.test/, backend.url);
  const { keepalive, ...rest } = options; // eslint-disable-line no-unused-vars
  return fetch(target, rest);
}

function device({ storage = memoryStorage(), online = () => true } = {}) {
  const timers = manualTimers();
  const remoteChanges = [];
  const statuses = [];
  const store = createStore({ storage });
  const sync = createSync({
    store,
    storage,
    fetch: routedFetch,
    pageUrl: PAGE,
    isOnline: online,
    onStatus: (s) => statuses.push(s),
    onRemoteChange: () => remoteChanges.push(true),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    log: quiet,
  });
  // Mirror main.js: every save asks sync to send.
  const commit = (next) => {
    store.commit(next);
    sync.schedule();
  };
  return { store, sync, timers, storage, statuses, remoteChanges, commit, data: () => syncedData(store.get()) };
}

async function serverCopy() {
  const res = await fetch(`${backend.url}/api/state`, { headers: { Authorization: `Bearer ${KEY}` } });
  return res.json();
}

async function freshBackend() {
  const server = createAppServer({ env: { SYNC_STORE: 'memory', SYNC_KEY: KEY }, log: quiet });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  backend.url = `http://127.0.0.1:${server.address().port}`;
  return server;
}

describe('sync between two devices', () => {
  const servers = [];
  before(async () => { servers.push(await freshBackend()); });
  after(() => { for (const s of servers) s.close(); });
  beforeEach(async () => {
    backend.offline = false;
    backend.delay = null;
    backend.calls = [];
    servers.push(await freshBackend());
  });

  test('connecting uploads this device’s progress and another device gets it', async () => {
    const laptop = device();
    laptop.commit(setStep(laptop.store.get(), 'c1', 'read', true));
    laptop.commit(setNotes(laptop.store.get(), 'c1', 'sorting notes'));
    assert.deepEqual(await laptop.sync.connect({ server: '', key: KEY }), { ok: true });
    assert.equal(laptop.sync.status().state, 'synced');
    assert.equal((await serverCopy()).data.topics.c1.notes, 'sorting notes');
    assert.equal(JSON.parse(laptop.storage.getItem(SYNC_STORAGE_KEY)).rev, 1);

    const phone = device();
    phone.store.commit(setTheme(phone.store.get(), 'dark'));
    assert.deepEqual(await phone.sync.connect({ server: '', key: KEY }), { ok: true });
    assert.equal(phone.store.get().topics.c1.read, true);
    assert.equal(phone.store.get().topics.c1.notes, 'sorting notes');
    assert.equal(phone.store.get().prefs.theme, 'dark', 'theme stays per device');
    assert.equal(phone.remoteChanges.length, 1);
    assert.equal(JSON.parse(phone.storage.getItem(STORAGE_KEY)).topics.c1.read, true, 'saved in the browser too');
    assert.equal(laptop.store.get().prefs.theme, 'system');
  });

  test('changes are sent shortly after they happen and pulled by the other device', async () => {
    const laptop = device();
    const phone = device();
    await laptop.sync.connect({ server: '', key: KEY });
    await phone.sync.connect({ server: '', key: KEY });

    laptop.commit(setStep(laptop.store.get(), 'c2', 'code', true));
    laptop.commit(setStep(laptop.store.get(), 'c2', 'practice', true));
    assert.equal(laptop.sync.status().state, 'syncing');
    assert.deepEqual(laptop.timers.delays(), [SEND_DELAY], 'quick changes share one send');
    const callsBefore = backend.calls.length;
    laptop.timers.runAll();
    await laptop.sync.syncNow({ pull: false });
    assert.equal(backend.calls.length - callsBefore, 1);
    assert.equal(laptop.sync.status().state, 'synced');

    await phone.sync.syncNow();
    assert.equal(phone.store.get().topics.c2.practice, true);
  });

  test('changes made on both devices at once are merged', async () => {
    const laptop = device();
    const phone = device();
    await laptop.sync.connect({ server: '', key: KEY });
    await phone.sync.connect({ server: '', key: KEY });

    laptop.commit(setStep(laptop.store.get(), 'c4', 'read', true));
    laptop.commit(setNotes(laptop.store.get(), 'c5', 'from the laptop'));
    phone.commit(addProblem(phone.store.get(), { name: 'Coin Combinations I' }).state);
    phone.commit(setNotes(phone.store.get(), 'c5', 'from the phone'));

    await laptop.sync.syncNow({ pull: false });
    await phone.sync.syncNow({ pull: false }); // gets a conflict, merges and sends the result
    await laptop.sync.syncNow();

    for (const d of [laptop, phone]) {
      const s = d.store.get();
      assert.equal(s.topics.c4.read, true);
      assert.equal(s.problems.length, 1);
      assert.equal(s.topics.c5.notes, 'from the phone\n\nfrom the laptop');
    }
    assert.deepEqual(laptop.data(), phone.data());
    assert.deepEqual((await serverCopy()).data, phone.data());
  });

  test('changes made while a request is on its way are kept', async () => {
    const laptop = device();
    const phone = device();
    await laptop.sync.connect({ server: '', key: KEY });
    await phone.sync.connect({ server: '', key: KEY });
    laptop.commit(setStep(laptop.store.get(), 'c6', 'read', true));
    await laptop.sync.syncNow({ pull: false });

    let typed = false;
    backend.delay = async () => {
      if (typed) return;
      typed = true;
      phone.commit(setNotes(phone.store.get(), 'c7', 'typed during the pull'));
    };
    await phone.sync.syncNow();
    backend.delay = null;
    assert.equal(phone.store.get().topics.c6.read, true);
    assert.equal(phone.store.get().topics.c7.notes, 'typed during the pull');
    phone.timers.runAll();
    await phone.sync.syncNow({ pull: false });
    assert.equal((await serverCopy()).data.topics.c7.notes, 'typed during the pull');
  });

  test('a theme change alone sends nothing', async () => {
    const laptop = device();
    await laptop.sync.connect({ server: '', key: KEY });
    laptop.commit(setTheme(laptop.store.get(), 'dark'));
    assert.equal(laptop.timers.count(), 0);
    assert.equal(laptop.sync.status().state, 'synced');
  });

  test('a wrong key is refused and nothing is saved', async () => {
    const laptop = device();
    assert.deepEqual(await laptop.sync.connect({ server: '', key: 'not-the-right-key-at-all' }), { ok: false, error: 'auth' });
    assert.equal(laptop.storage.getItem(SYNC_STORAGE_KEY), null);
    assert.equal(laptop.sync.isConnected(), false);
    assert.deepEqual(await laptop.sync.connect({ server: '', key: '  ' }), { ok: false, error: 'key' });
    assert.deepEqual(await laptop.sync.connect({ server: 'http://example.com', key: KEY }), { ok: false, error: 'https' });
  });

  test('sync stops when the key is no longer accepted, until it is entered again', async () => {
    const laptop = device();
    await laptop.sync.connect({ server: '', key: KEY });
    const config = JSON.parse(laptop.storage.getItem(SYNC_STORAGE_KEY));
    laptop.storage.setItem(SYNC_STORAGE_KEY, JSON.stringify({ ...config, key: 'an-old-key-that-was-changed' }));
    laptop.commit(setStep(laptop.store.get(), 'c8', 'read', true));
    laptop.timers.runAll();
    await laptop.sync.syncNow({ pull: false });
    assert.deepEqual(laptop.sync.status(), { state: 'error', error: 'auth', server: '' });
    assert.equal(laptop.timers.count(), 0, 'no retries with a refused key');
    const calls = backend.calls.length;
    laptop.commit(setStep(laptop.store.get(), 'c8', 'code', true));
    await laptop.sync.syncNow();
    assert.equal(backend.calls.length, calls, 'the refused key is not sent again');

    assert.deepEqual(await laptop.sync.connect({ server: '', key: KEY }), { ok: true });
    assert.equal(laptop.sync.status().state, 'synced');
    assert.equal((await serverCopy()).data.topics.c8.code, true);
  });

  test('when offline it waits and retries, without losing changes', async () => {
    let online = true;
    const laptop = device({ online: () => online });
    await laptop.sync.connect({ server: '', key: KEY });

    online = false;
    laptop.commit(setStep(laptop.store.get(), 'c9', 'read', true));
    laptop.timers.runAll();
    await laptop.sync.syncNow({ pull: false });
    assert.equal(laptop.sync.status().state, 'offline');

    online = true;
    backend.offline = true; // the browser thinks it's online, but requests fail
    await laptop.sync.syncNow({ pull: false });
    assert.equal(laptop.sync.status().state, 'offline');
    assert.deepEqual(laptop.timers.delays(), [RETRY_DELAYS[0]]);

    backend.offline = false;
    laptop.timers.runAll();
    await laptop.sync.syncNow({ pull: false });
    assert.equal(laptop.sync.status().state, 'synced');
    assert.equal((await serverCopy()).data.topics.c9.read, true);
    assert.equal(laptop.timers.count(), 0);
  });

  test('if the server loses its copy, this device sends its own again', async () => {
    const laptop = device();
    laptop.commit(setStep(laptop.store.get(), 'c10', 'read', true));
    await laptop.sync.connect({ server: '', key: KEY });
    servers.push(await freshBackend()); // an empty database
    await laptop.sync.syncNow();
    assert.equal(laptop.store.get().topics.c10.read, true, 'nothing is wiped here');
    const copy = await serverCopy();
    assert.equal(copy.rev, 1);
    assert.equal(copy.data.topics.c10.read, true);
  });

  test('disconnecting stops syncing but keeps progress', async () => {
    const laptop = device();
    laptop.commit(setStep(laptop.store.get(), 'c11', 'read', true));
    await laptop.sync.connect({ server: '', key: KEY });
    laptop.commit(setStep(laptop.store.get(), 'c11', 'code', true));
    laptop.sync.disconnect();
    assert.deepEqual(laptop.sync.status(), { state: 'off' });
    assert.equal(laptop.storage.getItem(SYNC_STORAGE_KEY), null);
    assert.equal(laptop.timers.count(), 0);
    assert.equal(laptop.store.get().topics.c11.code, true);
    const calls = backend.calls.length;
    await laptop.sync.syncNow();
    laptop.sync.pull();
    assert.equal(backend.calls.length, calls);
  });

  test('a disconnect while a request is on its way is not undone', async () => {
    const laptop = device();
    await laptop.sync.connect({ server: '', key: KEY });
    laptop.commit(setStep(laptop.store.get(), 'c12', 'read', true));
    backend.delay = async () => laptop.sync.disconnect();
    await laptop.sync.syncNow({ pull: false });
    assert.equal(laptop.storage.getItem(SYNC_STORAGE_KEY), null);
    assert.deepEqual(laptop.sync.status(), { state: 'off' });
  });

  test('requests carry the key only in the Authorization header', async () => {
    const laptop = device();
    await laptop.sync.connect({ server: 'https://elsewhere.test/', key: KEY });
    laptop.commit(setStep(laptop.store.get(), 'c13', 'read', true));
    laptop.sync.flush();
    await laptop.sync.syncNow({ pull: false });
    for (const call of backend.calls) {
      assert.equal(call.url, 'https://elsewhere.test/api/state');
      assert.equal(call.headers.Authorization, `Bearer ${KEY}`);
      assert.equal(call.credentials, 'omit');
      assert.equal(call.cache, 'no-store');
      if (call.body) assert.equal(call.body.includes(KEY), false);
    }
    assert.equal(backend.calls.at(-1).method, 'PUT');
    assert.equal(backend.calls.at(-1).keepalive, true, 'flush uses keepalive so it survives the page closing');
  });

  test('calls made while a sync waits or runs share one run', async () => {
    const laptop = device();
    await laptop.sync.connect({ server: '', key: KEY });
    let calls = backend.calls.length;
    await Promise.all([laptop.sync.syncNow(), laptop.sync.syncNow(), laptop.sync.syncNow()]);
    assert.equal(backend.calls.length - calls, 1, 'calls before it starts join it');

    calls = backend.calls.length;
    const first = laptop.sync.syncNow();
    await new Promise((resolve) => setImmediate(resolve)); // now it's waiting for the server
    await Promise.all([first, laptop.sync.syncNow(), laptop.sync.syncNow()]);
    assert.equal(backend.calls.length - calls, 2, 'calls during it share one follow-up run');
  });

  test('pulls when the app comes back into view, but not every moment', async () => {
    let clock = 0;
    const storage = memoryStorage();
    const store = createStore({ storage });
    const sync = createSync({ store, storage, fetch: routedFetch, pageUrl: PAGE, now: () => clock, log: quiet });
    await sync.connect({ server: '', key: KEY });
    const calls = backend.calls.length;
    sync.pull();
    clock += 11000;
    sync.pull();
    await sync.syncNow({ pull: false });
    sync.pull();
    assert.equal(backend.calls.length - calls, 1);
  });

  test('another tab’s settings are picked up', async () => {
    const storage = memoryStorage();
    const tab1 = device({ storage });
    const tab2 = device({ storage });
    await tab1.sync.connect({ server: '', key: KEY });
    assert.equal(tab2.sync.status().state, 'off');
    tab2.store.reload();
    tab2.sync.configChanged();
    await tab2.sync.syncNow({ pull: false });
    assert.equal(tab2.sync.status().state, 'synced');
    tab1.sync.disconnect();
    tab2.sync.configChanged();
    assert.equal(tab2.sync.status().state, 'off');
  });

  test('works without browser storage, for this tab only', async () => {
    const store = createStore({ storage: null });
    const sync = createSync({ store, storage: null, fetch: routedFetch, pageUrl: PAGE, log: quiet });
    assert.deepEqual(await sync.connect({ server: '', key: KEY }), { ok: true });
    assert.equal(sync.isConnected(), true);
    assert.equal(sync.status().state, 'synced');
  });
});

describe('sync errors', () => {
  test('explain what went wrong', async () => {
    const answers = {
      'not-found': () => new Response('<!doctype html><title>404</title>', { status: 404 }),
      'not-configured': () => Response.json({ error: 'not-configured' }, { status: 503 }),
      storage: () => Response.json({ error: 'storage-unavailable' }, { status: 502 }),
      server: () => new Response('A server error has occurred', { status: 500 }),
      network: () => { throw new TypeError('Failed to fetch'); },
    };
    for (const [code, answer] of Object.entries(answers)) {
      const store = createStore({ storage: null });
      const sync = createSync({ store, fetch: async () => answer(), log: quiet });
      assert.deepEqual(await sync.connect({ server: '', key: KEY }), { ok: false, error: code });
    }
    const store = createStore({ storage: null });
    const page = createSync({ store, fetch: async () => new Response('<html>a static page</html>'), log: quiet });
    assert.deepEqual(await page.connect({ server: '', key: KEY }), { ok: false, error: 'not-found' });
  });
});

test('normalizeServer and endpointFor', () => {
  assert.deepEqual(normalizeServer(''), { ok: true, server: '' });
  assert.deepEqual(normalizeServer(' https://ampratcp.vercel.app/ '), { ok: true, server: 'https://ampratcp.vercel.app' });
  assert.deepEqual(normalizeServer('ampratcp.vercel.app'), { ok: true, server: 'https://ampratcp.vercel.app' });
  assert.deepEqual(normalizeServer('https://a.vercel.app/api/state'), { ok: true, server: 'https://a.vercel.app' });
  assert.deepEqual(normalizeServer('http://localhost:8000'), { ok: true, server: 'http://localhost:8000' });
  assert.deepEqual(normalizeServer('http://example.com'), { ok: false, error: 'https' });
  assert.deepEqual(normalizeServer('https://user:pass@example.com'), { ok: false, error: 'address' });
  assert.deepEqual(normalizeServer('javascript:alert(1)'), { ok: false, error: 'address' });
  assert.equal(endpointFor('', 'https://keshav-pec.github.io/AmpratCP/#/home'), 'https://keshav-pec.github.io/AmpratCP/api/state');
  assert.equal(endpointFor('https://a.vercel.app', PAGE), 'https://a.vercel.app/api/state');
});
