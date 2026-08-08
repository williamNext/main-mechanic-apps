import Fastify from 'fastify';
import type { Db, Connection } from './db/client.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';

/**
 * Assembles the Fastify instance. Both the real server (src/server.ts) and
 * every test build the app through this same function against their own db
 * — there is no test-only code path.
 */
export function buildApp(db: Db, connection: Connection) {
  const app = Fastify({ logger: false });

  healthRoutes(app, connection);
  authRoutes(app, db);

  return app;
}
