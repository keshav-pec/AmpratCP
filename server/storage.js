// Where the sync server keeps the one shared copy of your progress.
// Both stores keep a single document { rev, data } and only accept a write that names the
// revision it was based on, so two devices can never silently overwrite each other.

const DOC_ID = 'main';

export function createMemoryStorage() {
  let doc = null;
  return {
    async read() {
      return doc ? { rev: doc.rev, data: structuredClone(doc.data) } : null;
    },
    async write(baseRev, data) {
      const currentRev = doc ? doc.rev : 0;
      if (baseRev !== currentRev) return { ok: false, current: doc ? { rev: doc.rev, data: structuredClone(doc.data) } : null };
      doc = { rev: currentRev + 1, data: structuredClone(data) };
      return { ok: true, rev: doc.rev };
    },
    async close() {},
  };
}

// `connect` is injectable for tests; by default it loads the official driver on first use,
// so the rest of the server (and the test suite) runs without it installed.
// Pass `MongoClient` when the driver is imported statically (the Vercel function does, so the
// bundler can't leave the driver out).
export function createMongoStorage({ uri, dbName = 'balloonroom', collectionName = 'state', connect, MongoClient = null } = {}) {
  if (!uri) throw new Error('A MongoDB connection string is required');
  let clientPromise = null;

  async function defaultConnect() {
    const Client = MongoClient || (await import('mongodb')).MongoClient;
    const client = new Client(uri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5, appName: 'balloon-room' });
    await client.connect();
    return client;
  }

  async function collection() {
    if (!clientPromise) {
      // Reused across requests (and across warm serverless invocations); reset on failure.
      clientPromise = (connect || defaultConnect)().catch((err) => {
        clientPromise = null;
        throw err;
      });
    }
    const client = await clientPromise;
    return client.db(dbName).collection(collectionName);
  }

  async function read() {
    const col = await collection();
    const doc = await col.findOne({ _id: DOC_ID });
    return doc ? { rev: doc.rev, data: doc.data } : null;
  }

  async function write(baseRev, data) {
    const col = await collection();
    const updatedAt = new Date();
    if (baseRev === 0) {
      try {
        await col.insertOne({ _id: DOC_ID, rev: 1, data, updatedAt });
        return { ok: true, rev: 1 };
      } catch (err) {
        if (err && err.code === 11000) return { ok: false, current: await read() }; // someone else wrote first
        throw err;
      }
    }
    const result = await col.updateOne({ _id: DOC_ID, rev: baseRev }, { $set: { data, rev: baseRev + 1, updatedAt } });
    if (result.matchedCount === 1) return { ok: true, rev: baseRev + 1 };
    return { ok: false, current: await read() };
  }

  async function close() {
    if (!clientPromise) return;
    const client = await clientPromise.catch(() => null);
    clientPromise = null;
    if (client) await client.close();
  }

  return { read, write, close };
}

// Picks the store from environment variables. Returns null when sync isn't configured.
export function storageFromEnv(env, { MongoClient = null } = {}) {
  // Values pasted into a dashboard often pick up spaces, a newline or surrounding quotes.
  const uri = String(env.MONGODB_URI || '').trim().replace(/^(['"])(.*)\1$/, '$2');
  if (uri) return createMongoStorage({ uri, dbName: (env.MONGODB_DB || '').trim() || 'balloonroom', MongoClient });
  if (env.SYNC_STORE === 'memory') return createMemoryStorage(); // local testing only: forgets everything on restart
  return null;
}
