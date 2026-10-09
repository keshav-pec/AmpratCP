// The sync API as a Vercel serverless function, served at /api/state.
// Set MONGODB_URI and SYNC_KEY in the Vercel project's Environment Variables, never in this
// repository: it is public. See the README for the full setup.

import { createSyncHandler, parseOrigins } from '../server/sync-handler.js';
import { storageFromEnv } from '../server/storage.js';

// Created once per instance, so warm invocations reuse the database connection.
export default createSyncHandler({
  storage: storageFromEnv(process.env),
  syncKey: process.env.SYNC_KEY,
  allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS),
});
