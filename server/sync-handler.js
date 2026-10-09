// The sync API: GET /api/state returns { rev, data }. PUT /api/state with { baseRev, data } saves
// a new revision and returns { rev }, or, if another device saved first, returns
// { conflict: true, rev, data } with the newer copy so the app can merge. (That's a normal part
// of syncing, so it's a 200, which keeps the browser console free of errors.)
// Every request must carry `Authorization: Bearer <SYNC_KEY>`.

import { createHash, timingSafeEqual } from 'node:crypto';
import { migrate, syncedData } from '../src/store.js';

export const MAX_BODY_BYTES = 1_000_000;
export const MIN_KEY_LENGTH = 16;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// The server stores the same clean shape the app uses, so nothing unexpected reaches the database.
export function cleanData(raw) {
  return syncedData(migrate(raw));
}

// Just in case a driver message ever includes a connection string, hide its user and password.
export function redact(message) {
  return String(message).replace(/\/\/[^@/\s]*@/g, '//<credentials>@');
}

export function parseOrigins(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

// Compare hashes so the check takes the same time whatever the key looks like.
function isAuthorized(header, syncKey) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const given = createHash('sha256').update(header.slice(7)).digest();
  const expected = createHash('sha256').update(syncKey).digest();
  return timingSafeEqual(given, expected);
}

function corsHeaders(origin, allowedOrigins) {
  if (!origin || !allowedOrigins.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  if (body === undefined) {
    res.end();
    return;
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function httpError(status, code) {
  return Object.assign(new Error(code), { status, code });
}

async function readJsonBody(req, maxBytes) {
  if (Number(req.headers['content-length']) > maxBytes) throw httpError(413, 'too-large');
  // Some hosts (Vercel) parse JSON bodies before the handler runs.
  let parsed;
  try {
    parsed = req.body;
  } catch {
    throw httpError(400, 'bad-json');
  }
  if (parsed !== undefined && parsed !== null) {
    if (typeof parsed === 'string' || Buffer.isBuffer(parsed)) {
      const text = String(parsed);
      if (Buffer.byteLength(text) > maxBytes) throw httpError(413, 'too-large');
      try {
        return JSON.parse(text);
      } catch {
        throw httpError(400, 'bad-json');
      }
    }
    if (Buffer.byteLength(JSON.stringify(parsed)) > maxBytes) throw httpError(413, 'too-large');
    return parsed;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw httpError(413, 'too-large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw httpError(400, 'bad-json');
  }
}

export function createSyncHandler({ storage, syncKey, allowedOrigins = [], maxBytes = MAX_BODY_BYTES, log = console } = {}) {
  const configured = Boolean(storage) && typeof syncKey === 'string' && syncKey.length >= MIN_KEY_LENGTH;

  return async function syncHandler(req, res) {
    const cors = corsHeaders(req.headers.origin, allowedOrigins);
    try {
      if (req.method === 'OPTIONS') return send(res, 204, undefined, cors);
      if (!configured) return send(res, 503, { error: 'not-configured' }, cors);
      if (!isAuthorized(req.headers.authorization, syncKey)) return send(res, 401, { error: 'unauthorized' }, cors);

      if (req.method === 'GET') {
        const doc = await storage.read();
        return send(res, 200, { rev: doc ? doc.rev : 0, data: doc ? doc.data : null }, cors);
      }

      if (req.method === 'PUT') {
        const body = await readJsonBody(req, maxBytes);
        if (!isObject(body) || !Number.isInteger(body.baseRev) || body.baseRev < 0 || !isObject(body.data)) {
          return send(res, 400, { error: 'bad-request' }, cors);
        }
        const result = await storage.write(body.baseRev, cleanData(body.data));
        if (result.ok) return send(res, 200, { rev: result.rev }, cors);
        const current = result.current;
        return send(res, 200, { conflict: true, rev: current ? current.rev : 0, data: current ? current.data : null }, cors);
      }

      return send(res, 405, { error: 'method-not-allowed' }, { ...cors, Allow: 'GET, PUT, OPTIONS' });
    } catch (err) {
      if (err && err.status) return send(res, err.status, { error: err.code }, cors);
      log.error('Sync storage error:', redact(err && err.message));
      return send(res, 502, { error: 'storage-unavailable' }, cors);
    }
  };
}
