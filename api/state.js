// The sync API as a Vercel serverless function, served at /api/state.
// Set MONGODB_URI and SYNC_KEY in the Vercel project's Environment Variables, never in this
// repository: it is public. See the README for the full setup.

import { MongoClient } from 'mongodb';
import { createSyncHandler, parseOrigins } from '../server/sync-handler.js';
import { storageFromEnv } from '../server/storage.js';

// Created once per instance, so warm invocations reuse the database connection.
// The driver is imported here, not on first use, so Vercel always bundles it.
export default createSyncHandler({
  storage: storageFromEnv(process.env, { MongoClient }),
  syncKey: String(process.env.SYNC_KEY || '').trim(),
  allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS),
});
