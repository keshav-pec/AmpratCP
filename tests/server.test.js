import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer, publicFile } from '../server/serve.js';
import { createSyncHandler, cleanData, parseOrigins, redact, storageReason, MAX_BODY_BYTES } from '../server/sync-handler.js';
import { createMemoryStorage, createMongoStorage, storageFromEnv } from '../server/storage.js';
import { TOPICS } from '../src/data.js';

const KEY = 'test-key-0123456789-abcdefghij';
const SITE = 'https://example.github.io';
const quiet = { error() {} };

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

function call(base, { method = 'GET', key = KEY, body, headers = {} } = {}) {
  return fetch(`${base}/api/state`, {
    method,
    headers: {
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

describe('sync API', () => {
  let server;
  let base;
  before(async () => {
    server = createAppServer({ env: { SYNC_STORE: 'memory', SYNC_KEY: KEY, ALLOWED_ORIGINS: `${SITE}/` }, log: quiet });
    base = await listen(server);
  });
  after(() => server.close());

  test('requires the sync key', async () => {
    assert.equal((await call(base, { key: null })).status, 401);
    assert.equal((await call(base, { key: 'wrong-key-0123456789-abcdefghij' })).status, 401);
    assert.equal((await call(base, { key: `${KEY}x` })).status, 401);
    const res = await call(base, { headers: { Authorization: `Basic ${KEY}` }, key: null });
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: 'unauthorized' });
  });

  test('starts empty, saves a revision and refuses a stale one', async () => {
    const empty = await call(base);
    assert.equal(empty.status, 200);
    assert.equal(empty.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await empty.json(), { rev: 0, data: null });

    const first = await call(base, {
      method: 'PUT',
      body: { baseRev: 0, data: { topics: { c1: { read: true, notes: 'hi' } }, prefs: { theme: 'dark' } } },
    });
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { rev: 1 });

    const saved = await (await call(base)).json();
    assert.equal(saved.rev, 1);
    assert.equal(saved.data.version, 2);
    assert.equal(saved.data.topics.c1.read, true);
    assert.equal(saved.data.topics.c1.notes, 'hi');
    assert.equal(Object.keys(saved.data.topics).length, TOPICS.length);
    assert.equal('prefs' in saved.data, false, 'theme and sidebar stay on each device');

    const stale = await call(base, { method: 'PUT', body: { baseRev: 0, data: { topics: {} } } });
    assert.equal(stale.status, 200, 'a conflict is a normal answer, not an error');
    const conflict = await stale.json();
    assert.equal(conflict.conflict, true);
    assert.equal(conflict.rev, 1);
    assert.equal(conflict.data.topics.c1.notes, 'hi');

    const second = await call(base, { method: 'PUT', body: { baseRev: 1, data: saved.data } });
    assert.deepEqual(await second.json(), { rev: 2 });
  });

  test('rejects malformed requests', async () => {
    assert.equal((await call(base, { method: 'PUT', body: '{nope' })).status, 400);
    assert.equal((await call(base, { method: 'PUT', body: '' })).status, 400);
    assert.equal((await call(base, { method: 'PUT', body: { baseRev: 0 } })).status, 400);
    assert.equal((await call(base, { method: 'PUT', body: { baseRev: -1, data: {} } })).status, 400);
    assert.equal((await call(base, { method: 'PUT', body: { baseRev: '2', data: {} } })).status, 400);
    assert.equal((await call(base, { method: 'PUT', body: { baseRev: 2, data: [] } })).status, 400);
    assert.equal((await call(base, { method: 'PUT', body: [1, 2] })).status, 400);
    const big = { baseRev: 0, data: { topics: { c1: { notes: 'x'.repeat(MAX_BODY_BYTES) } } } };
    assert.equal((await call(base, { method: 'PUT', body: big })).status, 413);
    const del = await call(base, { method: 'DELETE' });
    assert.equal(del.status, 405);
    assert.equal(del.headers.get('allow'), 'GET, PUT, OPTIONS');
  });

  test('allows browsers only from the listed sites', async () => {
    const preflight = await fetch(`${base}/api/state`, {
      method: 'OPTIONS',
      headers: { Origin: SITE, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'authorization,content-type' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), SITE);
    assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);
    assert.match(preflight.headers.get('access-control-allow-methods'), /PUT/);

    const other = await fetch(`${base}/api/state`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
    assert.equal(other.status, 204);
    assert.equal(other.headers.get('access-control-allow-origin'), null);

    const get = await call(base, { headers: { Origin: SITE } });
    assert.equal(get.headers.get('access-control-allow-origin'), SITE);
    assert.equal(get.headers.get('vary'), 'Origin');
    const denied = await call(base, { key: null, headers: { Origin: SITE } });
    assert.equal(denied.status, 401);
    assert.equal(denied.headers.get('access-control-allow-origin'), SITE, 'so the app can show why');
  });
});

describe('sync API when not set up', () => {
  test('answers 503 without storage or with a short key', async () => {
    for (const env of [{ SYNC_KEY: KEY }, { SYNC_STORE: 'memory', SYNC_KEY: 'short' }, { SYNC_STORE: 'memory' }]) {
      const server = createAppServer({ env, log: quiet });
      const base = await listen(server);
      const res = await call(base);
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { error: 'not-configured' });
      server.close();
    }
  });
});

// Minimal stand-ins for Node's req/res, shaped like what Vercel passes to a function.
function fakeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { res.headers[name.toLowerCase()] = value; },
    end(chunk) { res.body = chunk === undefined ? '' : String(chunk); res.done = true; },
  };
  return res;
}

describe('sync handler', () => {
  test('uses a body the host already parsed', async () => {
    const handler = createSyncHandler({ storage: createMemoryStorage(), syncKey: KEY });
    const res = fakeRes();
    await handler({ method: 'PUT', headers: { authorization: `Bearer ${KEY}` }, body: { baseRev: 0, data: { problems: [] } } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { rev: 1 });

    const res2 = fakeRes();
    const badBody = { method: 'PUT', headers: { authorization: `Bearer ${KEY}` } };
    Object.defineProperty(badBody, 'body', { get() { throw new SyntaxError('Invalid JSON'); } });
    await handler(badBody, res2);
    assert.equal(res2.statusCode, 400);

    const res3 = fakeRes();
    await handler({ method: 'PUT', headers: { authorization: `Bearer ${KEY}` }, body: JSON.stringify({ baseRev: 1, data: {} }) }, res3);
    assert.equal(res3.statusCode, 200);
  });

  test('hides storage errors from the client and keeps passwords out of logs', async () => {
    const logged = [];
    const storage = {
      async read() { throw new Error('getaddrinfo ENOTFOUND for mongodb+srv://user:hunter2@db.example.net'); },
      async write() { throw new Error('down'); },
    };
    const handler = createSyncHandler({ storage, syncKey: KEY, log: { error: (...args) => logged.push(args.join(' ')) } });
    const res = fakeRes();
    await handler({ method: 'GET', headers: { authorization: `Bearer ${KEY}` } }, res);
    assert.equal(res.statusCode, 502);
    assert.deepEqual(JSON.parse(res.body), { error: 'storage-unavailable', reason: 'dns' });
    assert.equal(logged.length, 1);
    assert.doesNotMatch(logged[0], /hunter2/);
    assert.match(logged[0], /ENOTFOUND/);
  });
});

describe('server helpers', () => {
  test('cleanData keeps only the app’s own shape', () => {
    const raw = JSON.parse('{"topics":{"__proto__":{"read":true},"c2":{"read":true,"evil":"$where"},"$bad":{},"a.b":{}},'
      + '"weekChecks":{"1":{"practice":true,"$set":true}},"problems":[{"name":"A","url":"javascript:alert(1)","extra":1}],'
      + '"prefs":{"theme":"dark"},"other":1}');
    const data = cleanData(raw);
    assert.deepEqual(Object.keys(data).sort(), ['problems', 'topics', 'version', 'weekChecks']);
    assert.equal(Object.getPrototypeOf(data.topics), Object.prototype);
    assert.equal(Object.hasOwn(data.topics, '__proto__'), false);
    assert.equal('$bad' in data.topics || 'a.b' in data.topics, false);
    assert.deepEqual(data.topics.c2, { read: false, practice: false, notes: '' });
    assert.deepEqual(data.weekChecks, { 1: { practice: true } });
    assert.equal(data.problems[0].url, '');
    assert.equal('extra' in data.problems[0], false);
  });

  test('parseOrigins trims spaces and trailing slashes', () => {
    assert.deepEqual(parseOrigins(' https://a.github.io/ , http://localhost:8000,,'), ['https://a.github.io', 'http://localhost:8000']);
    assert.deepEqual(parseOrigins(undefined), []);
  });

  test('redact hides credentials in connection strings', () => {
    assert.equal(redact('mongodb+srv://u:p@h.net/x'), 'mongodb+srv://<credentials>@h.net/x');
    assert.equal(redact('no secrets here'), 'no secrets here');
  });

  test('storageFromEnv picks MongoDB, memory or nothing', () => {
    assert.equal(storageFromEnv({}), null);
    assert.equal(typeof storageFromEnv({ SYNC_STORE: 'memory' }).write, 'function');
    assert.equal(typeof storageFromEnv({ MONGODB_URI: 'mongodb://localhost:1' }).write, 'function');
  });

  test('publicFile serves only the app’s own files', () => {
    assert.match(publicFile('/'), /index\.html$/);
    assert.match(publicFile('/styles.css'), /styles\.css$/);
    assert.match(publicFile('/src/views/home.js'), /home\.js$/);
    assert.match(publicFile('/CP_book.pdf'), /CP_book\.pdf$/);
    assert.match(publicFile('/book.html'), /book\.html$/);
    assert.match(publicFile('/vendor/pdfjs/pdf.worker.min.js'), /pdf\.worker\.min\.js$/);
    for (const path of ['/.env', '/.git/config', '/package.json', '/server/storage.js', '/api/state.js',
      '/node_modules/mongodb/package.json', '/src/../package.json', '/%2e%2e/package.json', '/src/%2e%2e/.env',
      '/src//main.js', '/src/main.js%00', '/src/..%5c..%5c.env', '/%E0%A4%A', '/src/notes.txt', '/tests/store.test.js',
      '/vendor/pdfjs/LICENSE', '/vendor/../server/serve.js']) {
      assert.equal(publicFile(path), null, path);
    }
  });
});

describe('static files', () => {
  let server;
  let base;
  before(async () => {
    server = createAppServer({ env: {}, log: quiet });
    base = await listen(server);
  });
  after(() => server.close());

  test('serves the app and nothing else', async () => {
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    assert.match(await page.text(), /Balloon Room/);
    const script = await fetch(`${base}/src/main.js`);
    assert.match(script.headers.get('content-type'), /text\/javascript/);
    assert.equal(script.headers.get('x-content-type-options'), 'nosniff');
    assert.equal((await fetch(`${base}/package.json`)).status, 404);
    assert.equal((await fetch(`${base}/src/missing.js`)).status, 404);
    assert.equal((await fetch(`${base}/`, { method: 'POST' })).status, 405);
  });
});

// Runs only when a test database is given, for example:
//   MONGODB_TEST_URI=mongodb://127.0.0.1:27017 npm test
// Each run uses (and then drops) its own database, so it never touches real progress.
const MONGO = process.env.MONGODB_TEST_URI;
describe('MongoDB storage', { skip: MONGO ? false : 'set MONGODB_TEST_URI to run' }, () => {
  const dbName = `balloonroom_test_${process.pid}_${Date.now()}`;
  let storage;
  before(() => { storage = createMongoStorage({ uri: MONGO, dbName }); });
  after(async () => {
    const { MongoClient } = await import('mongodb');
    const client = await MongoClient.connect(MONGO);
    await client.db(dbName).dropDatabase();
    await client.close();
    await storage.close();
  });

  test('keeps one document and refuses stale writes', async () => {
    assert.equal(await storage.read(), null);
    assert.deepEqual(await storage.write(0, { a: 1 }), { ok: true, rev: 1 });
    const stale = await storage.write(0, { a: 2 });
    assert.equal(stale.ok, false);
    assert.deepEqual(stale.current, { rev: 1, data: { a: 1 } });
    assert.deepEqual(await storage.write(1, { a: 3 }), { ok: true, rev: 2 });
    assert.deepEqual((await storage.write(1, { a: 4 })).current, { rev: 2, data: { a: 3 } });
    assert.deepEqual(await storage.read(), { rev: 2, data: { a: 3 } });
  });

  test('lets exactly one of two simultaneous writes win', async () => {
    const { rev } = await storage.read();
    const results = await Promise.all([storage.write(rev, { who: 'laptop' }), storage.write(rev, { who: 'phone' })]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal((await storage.read()).rev, rev + 1);
  });

  test('works behind the sync API', async () => {
    const server = createAppServer({ env: { MONGODB_URI: MONGO, MONGODB_DB: `${dbName}_api`, SYNC_KEY: KEY }, log: quiet });
    const base = await listen(server);
    assert.deepEqual(await (await call(base)).json(), { rev: 0, data: null });
    assert.equal((await call(base, { method: 'PUT', body: { baseRev: 0, data: { problems: [{ name: 'Two Sets' }] } } })).status, 200);
    const saved = await (await call(base)).json();
    assert.equal(saved.rev, 1);
    assert.equal(saved.data.problems[0].name, 'Two Sets');
    server.close();
    const { MongoClient } = await import('mongodb');
    const client = await MongoClient.connect(MONGO);
    await client.db(`${dbName}_api`).dropDatabase();
    await client.close();
  });
});

describe('MongoDB connection', () => {
  test('retries the connection after a failure', async () => {
    let attempts = 0;
    const docs = new Map();
    const collection = {
      async findOne({ _id }) { return docs.get(_id) || null; },
      async insertOne(doc) { docs.set(doc._id, doc); },
      async updateOne() { return { matchedCount: 0 }; },
    };
    const storage = createMongoStorage({
      uri: 'mongodb://unused',
      async connect() {
        attempts += 1;
        if (attempts === 1) throw new Error('network down');
        return { db: () => ({ collection: () => collection }), close: async () => {} };
      },
    });
    await assert.rejects(storage.read(), /network down/);
    assert.equal(await storage.read(), null);
    assert.deepEqual(await storage.write(0, { x: 1 }), { ok: true, rev: 1 });
    assert.equal(attempts, 2, 'the working connection is reused');
    await storage.close();
  });

  test('needs a connection string', () => {
    assert.throws(() => createMongoStorage({}), /connection string/);
  });
});

describe('database problems are named', () => {
  const err = (name, message, code) => Object.assign(new Error(message), { name, code });
  test('storageReason sorts driver errors into causes', () => {
    assert.equal(storageReason(err('MongoServerError', 'bad auth : authentication failed', 8000)), 'auth');
    assert.equal(storageReason(err('MongoServerError', 'Authentication failed.', 18)), 'auth');
    assert.equal(storageReason(err('MongoServerSelectionError', 'Server selection timed out after 8000 ms')), 'network');
    assert.equal(storageReason(err('MongoServerSelectionError', 'connection <monitor> to 1.2.3.4:27017 closed')), 'network');
    assert.equal(storageReason(err('Error', 'querySrv ENOTFOUND _mongodb._tcp.nope.mongodb.net')), 'dns');
    assert.equal(storageReason(err('MongoParseError', 'Password contains unescaped characters')), 'uri');
    assert.equal(storageReason(err('MongoServerError', 'user is not allowed to do action [insert] on [balloonroom.state]', 8000)), 'auth');
    assert.equal(storageReason(err('MongoServerError', 'not authorized on balloonroom to execute command', 13)), 'permission');
    assert.equal(storageReason(err('Error', "Cannot find package 'mongodb' imported from /var/task/server/storage.js", 'ERR_MODULE_NOT_FOUND')), 'driver');
    assert.equal(storageReason(new Error('something else')), 'other');
  });

  test('the real driver reports a bad connection string and an unknown cluster', async () => {
    for (const [uri, reason] of [['mongodb+srv://user:p@ss@cluster0.example.mongodb.net/', 'uri'], ['mongodb+srv://u:p@no-such-cluster.invalid/', 'dns']]) {
      const server = createAppServer({ env: { MONGODB_URI: uri, SYNC_KEY: KEY }, log: quiet });
      const base = await listen(server);
      const res = await call(base);
      assert.equal(res.status, 502);
      assert.deepEqual(await res.json(), { error: 'storage-unavailable', reason }, uri);
      server.close();
    }
  });

  test('a pasted connection string with quotes or spaces still works', () => {
    assert.equal(typeof storageFromEnv({ MONGODB_URI: ' "mongodb://localhost:1" \n' }).write, 'function');
  });
});
