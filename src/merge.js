// Three-way merge for sync. `base` is the copy both sides last agreed on, `local` is this
// device's copy and `remote` is the server's. Changes from both sides are kept. When both
// changed the same thing, this device wins, except for notes: both versions are kept, so no
// typed text is ever lost. Logged problems are matched by id, and an edit beats a delete.

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (obj, key) => (isObject(obj) && Object.hasOwn(obj, key) ? obj[key] : undefined);
const isIdList = (list) => Array.isArray(list) && list.every((item) => isObject(item) && typeof item.id === 'string');

// Equality for JSON-shaped values. Key order doesn't matter.
export function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  if (!isObject(a) || !isObject(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
}

function combineNotes(local, remote) {
  if (local.includes(remote)) return local;
  if (remote.includes(local)) return remote;
  return `${local}\n\n${remote}`;
}

function mergeObjects(base, local, remote) {
  const out = {};
  for (const key of new Set([...Object.keys(local || {}), ...Object.keys(remote || {})])) {
    if (key === '__proto__') continue;
    const value = mergeValue(own(base, key), own(local, key), own(remote, key), key);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function mergeById(base, local, remote) {
  const index = (list) => new Map(list.map((item) => [item.id, item]));
  const b = index(isIdList(base) ? base : []);
  const l = index(local);
  const r = index(remote);
  const out = [];
  const seen = new Set();
  // The server's order first, then anything only this device has.
  for (const { id } of [...remote, ...local]) {
    if (seen.has(id)) continue;
    seen.add(id);
    let item;
    if (l.has(id) && r.has(id)) {
      item = mergeValue(b.get(id), l.get(id), r.get(id), null);
    } else {
      // Only one side has it: it was added there, or the other side deleted it.
      // A delete wins unless this side also edited it.
      const kept = l.has(id) ? l.get(id) : r.get(id);
      item = b.has(id) && deepEqual(b.get(id), kept) ? undefined : kept;
    }
    if (item !== undefined) out.push(item);
  }
  return out;
}

function mergeValue(base, local, remote, key) {
  if (deepEqual(local, remote)) return local;
  if (deepEqual(base, local)) return remote;
  if (deepEqual(base, remote)) return local;
  // Both sides changed it, in different ways.
  if (key === 'notes' && typeof local === 'string' && typeof remote === 'string') return combineNotes(local, remote);
  if (isIdList(local) && isIdList(remote)) return mergeById(base, local, remote);
  const objectLike = (v) => v === undefined || isObject(v);
  if (objectLike(base) && objectLike(local) && objectLike(remote)) return mergeObjects(base, local, remote);
  return local;
}

export function merge3(base, local, remote) {
  return mergeValue(base, local, remote, null);
}
