// Optional sync between your devices through your own sync server (see the README).
// The app stays local-first: every change is saved in this browser straight away and sent to
// the server shortly after. Changes made on other devices are pulled in when the app opens and
// when it comes back into view. If two devices changed things at the same time, the copies are
// merged (see merge.js). Theme and sidebar stay per device.
//
// Nothing here touches the page, so it runs in Node tests with a fake fetch and timers.

import { migrate, syncedData, defaultState } from './store.js';
import { merge3, deepEqual } from './merge.js';

export const SYNC_STORAGE_KEY = 'balloonroom:sync';
export const SEND_DELAY = 1500;
export const PULL_GAP = 10000;
export const RETRY_DELAYS = [5000, 15000, 30000, 60000, 120000, 300000];
const MAX_ROUNDS = 6;
const KEEPALIVE_LIMIT = 60000; // browsers refuse keepalive requests over 64 KB
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

export class SyncError extends Error {
  constructor(code, reason = null) {
    super(code);
    this.code = code;
    this.reason = reason;
  }
}

export function emptyData() {
  return syncedData(defaultState());
}

function clean(data) {
  return syncedData(migrate(data));
}

// '' means "this site". Otherwise an https:// address (http:// only for this computer), with
// or without a trailing /api/state. Returns { ok, server } or { ok: false, error }.
export function normalizeServer(input) {
  const value = String(input || '').trim();
  if (!value) return { ok: true, server: '' };
  let url;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return { ok: false, error: 'address' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, error: 'address' };
  if (url.protocol === 'http:' && !LOCAL_HOSTS.includes(url.hostname)) return { ok: false, error: 'https' };
  if (url.username || url.password || url.search || url.hash) return { ok: false, error: 'address' };
  const path = url.pathname.replace(/\/+$/, '').replace(/\/api\/state$/, '');
  return { ok: true, server: `${url.origin}${path}` };
}

export function endpointFor(server, pageUrl) {
  return server ? `${server}/api/state` : new URL('api/state', pageUrl).href;
}

function errorFor(status, code) {
  if (status === 401) return 'auth';
  if (code === 'not-configured') return 'not-configured';
  if (code === 'storage-unavailable') return 'storage';
  if (status === 413) return 'too-large';
  if (code || status >= 500 || status === 408 || status === 429) return 'server';
  return 'not-found'; // something answered, but it isn't a sync server
}

function readConfig(storage) {
  let parsed;
  try {
    parsed = JSON.parse(storage.getItem(SYNC_STORAGE_KEY));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed.key !== 'string' || !parsed.key || typeof parsed.server !== 'string') return null;
  return {
    server: parsed.server,
    key: parsed.key,
    rev: Number.isInteger(parsed.rev) && parsed.rev >= 0 ? parsed.rev : 0,
    base: parsed.base && typeof parsed.base === 'object' ? clean(parsed.base) : emptyData(),
  };
}

export function createSync({
  store,
  storage = null,
  fetch: fetchImpl,
  pageUrl = 'http://localhost/',
  isOnline = () => true,
  onStatus = () => {},
  onRemoteChange = () => {},
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = Date.now,
  log = console,
}) {
  // The settings live in this browser's storage, so every tab shares them. If storage is blocked
  // or full, they're kept in memory instead and sync still works until the tab closes.
  let memory = null;
  let useMemory = !storage;
  let status = { state: 'off' };
  let generation = 0; // bumped on connect and disconnect, so a request in flight can't undo them
  let blockedKey = null; // a key the server refused; not retried until it changes
  let applying = false;
  let sendTimer = null;
  let retryTimer = null;
  let retries = 0;
  let lastPull = -Infinity;
  let queue = Promise.resolve();
  let waiting = null;

  function loadConfig() {
    return useMemory ? memory : readConfig(storage);
  }

  function saveConfig(config) {
    memory = config;
    if (useMemory) return;
    try {
      storage.setItem(SYNC_STORAGE_KEY, JSON.stringify(config));
    } catch {
      useMemory = true;
    }
  }

  function clearConfig() {
    memory = null;
    if (!storage) return;
    try {
      storage.removeItem(SYNC_STORAGE_KEY);
    } catch {
      // Blocked storage has nothing saved to remove.
    }
  }

  function setStatus(next) {
    if (deepEqual(next, status)) return;
    status = next;
    onStatus(status);
  }

  function statusFor(config, state, error) {
    return error ? { state, error, server: config.server } : { state, server: config.server };
  }

  function cancelTimers() {
    clearTimer(sendTimer);
    clearTimer(retryTimer);
    sendTimer = null;
    retryTimer = null;
  }

  async function request(config, method, body, { keepalive = false } = {}) {
    const text = body === undefined ? undefined : JSON.stringify(body);
    const headers = { Authorization: `Bearer ${config.key}` };
    if (text !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetchImpl(endpointFor(config.server, pageUrl), {
        method,
        headers,
        body: text,
        cache: 'no-store',
        credentials: 'omit',
        keepalive: keepalive && text !== undefined && text.length < KEEPALIVE_LIMIT,
      });
    } catch {
      throw new SyncError('network');
    }
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    const code = json && typeof json.error === 'string' ? json.error : null;
    if (res.ok && json && Number.isInteger(json.rev)) return { conflict: json.conflict === true, rev: json.rev, data: json.data };
    throw new SyncError(errorFor(res.status, code), json && typeof json.reason === 'string' ? json.reason : null);
  }

  // Puts a merged or downloaded copy into the app, keeping anything changed here meanwhile.
  function apply(base, theirs) {
    const current = store.get();
    const next = merge3(base, syncedData(current), theirs);
    if (deepEqual(next, syncedData(current))) return;
    applying = true;
    try {
      store.commit({ ...migrate(next), prefs: current.prefs });
    } finally {
      applying = false;
    }
    onRemoteChange();
  }

  async function run({ pull, keepalive }) {
    const config = loadConfig();
    if (!config) {
      cancelTimers();
      setStatus({ state: 'off' });
      return status;
    }
    if (config.key === blockedKey) {
      setStatus(statusFor(config, 'error', 'auth'));
      return status;
    }
    if (!isOnline()) {
      setStatus(statusFor(config, 'offline'));
      return status;
    }
    // False once this device disconnected or reconnected, here or in another tab, while waiting.
    const gen = generation;
    const current = () => {
      const latest = gen === generation && loadConfig();
      return Boolean(latest) && latest.key === config.key && latest.server === config.server;
    };
    let { rev, base } = config;
    const remember = () => saveConfig({ ...config, rev, base });
    const busy = () => setStatus(statusFor(config, 'syncing'));

    try {
      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const local = syncedData(store.get());
        if (deepEqual(local, base)) {
          if (!pull) break;
          pull = false;
          busy();
          const remote = await request(config, 'GET');
          if (!current()) return status;
          if (remote.rev === rev) break;
          rev = remote.rev;
          if (remote.data) {
            const theirs = clean(remote.data);
            apply(base, theirs);
            base = theirs;
          } else {
            base = emptyData(); // the server lost its copy: the next round sends ours
          }
          remember();
          continue;
        }

        busy();
        const sent = await request(config, 'PUT', { baseRev: rev, data: local }, { keepalive });
        if (!current()) return status;
        rev = sent.rev;
        if (!sent.conflict) {
          base = local;
        } else if (sent.data) {
          // Another device saved first: merge, then send the result in the next round.
          const theirs = clean(sent.data);
          apply(base, theirs);
          base = theirs;
        } else {
          base = emptyData();
        }
        remember();
      }
      retries = 0;
      clearTimer(retryTimer);
      retryTimer = null;
      if (!deepEqual(syncedData(store.get()), base)) {
        // Still changing (another device kept saving): try again shortly.
        busy();
        armSend();
        return status;
      }
      setStatus(statusFor(config, 'synced'));
    } catch (err) {
      if (!current()) return status;
      if (!(err instanceof SyncError)) log.error('Sync failed:', err);
      const code = err instanceof SyncError ? err.code : 'server';
      if (code === 'auth') {
        blockedKey = config.key;
        cancelTimers();
        setStatus(statusFor(config, 'error', 'auth'));
        return status;
      }
      setStatus(code === 'network' ? statusFor(config, 'offline') : statusFor(config, 'error', code));
      if (code !== 'too-large') {
        clearTimer(retryTimer);
        const delay = RETRY_DELAYS[Math.min(retries, RETRY_DELAYS.length - 1)];
        retries += 1;
        retryTimer = setTimer(() => {
          retryTimer = null;
          syncNow();
        }, delay);
      }
    }
    return status;
  }

  function armSend() {
    clearTimer(sendTimer);
    sendTimer = setTimer(() => {
      sendTimer = null;
      syncNow({ pull: false });
    }, SEND_DELAY);
  }

  // Runs one sync at a time. Calls made while one runs share the next run.
  function syncNow({ pull = true, keepalive = false } = {}) {
    if (waiting) {
      waiting.pull = waiting.pull || pull;
      waiting.keepalive = waiting.keepalive || keepalive;
      return waiting.promise;
    }
    const job = { pull, keepalive };
    job.promise = queue.then(() => {
      if (waiting === job) waiting = null;
      return run(job);
    });
    waiting = job;
    queue = job.promise.catch(() => {});
    return job.promise;
  }

  return {
    status: () => status,
    isConnected: () => Boolean(loadConfig()),
    server: () => {
      const config = loadConfig();
      return config ? config.server : '';
    },

    // Checks the address and key with the server, then syncs. Both copies are merged, so
    // connecting never loses progress made on either side.
    async connect({ server, key }) {
      const address = normalizeServer(server);
      if (!address.ok) return { ok: false, error: address.error };
      const secret = String(key || '').trim();
      if (!secret) return { ok: false, error: 'key' };
      const config = { server: address.server, key: secret, rev: 0, base: emptyData() };
      try {
        await request(config, 'GET');
      } catch (err) {
        if (!(err instanceof SyncError)) return { ok: false, error: 'server' };
        return err.reason ? { ok: false, error: err.code, reason: err.reason } : { ok: false, error: err.code };
      }
      generation += 1;
      blockedKey = null;
      retries = 0;
      cancelTimers();
      saveConfig(config);
      lastPull = now();
      await syncNow();
      return { ok: true };
    },

    // Stops syncing on this device. Progress stays in this browser.
    disconnect() {
      generation += 1;
      blockedKey = null;
      cancelTimers();
      clearConfig();
      setStatus({ state: 'off' });
    },

    // At startup.
    start() {
      lastPull = now();
      return syncNow();
    },

    syncNow,

    // After a local change: send it soon, so quick changes go together.
    schedule() {
      if (applying) return;
      const config = loadConfig();
      if (!config || config.key === blockedKey) return;
      if (deepEqual(syncedData(store.get()), config.base)) return;
      if (status.state === 'synced') setStatus(statusFor(config, 'syncing'));
      armSend();
    },

    // The page is being hidden or closed: send a waiting change now.
    flush() {
      if (!sendTimer) return;
      clearTimer(sendTimer);
      sendTimer = null;
      syncNow({ pull: false, keepalive: true });
    },

    // The app came back into view: look for changes from other devices, at most every few seconds.
    pull() {
      if (!loadConfig() || now() - lastPull < PULL_GAP) return;
      lastPull = now();
      syncNow();
    },

    // Another tab connected, disconnected or synced.
    configChanged() {
      const config = loadConfig();
      if (!config) {
        cancelTimers();
        setStatus({ state: 'off' });
        return;
      }
      if (config.key !== blockedKey) blockedKey = null;
      syncNow({ pull: false });
    },
  };
}
