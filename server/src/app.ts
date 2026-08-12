import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import type { Db, Connection } from './db/client.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { mechanicsRoutes } from './routes/mechanics.js';
import { HttpError } from './errors.js';

export const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19007',
  'http://127.0.0.1:19006',
  'http://127.0.0.1:19008',
];

/**
 * Assembles the Fastify instance. Both the real server (src/server.ts) and
 * every test build the app through this same function against their own db
 * — there is no test-only code path.
 */
export function buildApp(db: Db, connection: Connection) {
  const app = Fastify({ logger: false });

  app.register(cors, {
    origin: ALLOWED_ORIGINS,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // D-C: every failure returns { error: '<lowercase message>' }. Registered
  // here (not in server.ts) so tests exercise the same handler the real
  // server runs.
  app.setErrorHandler((err: FastifyError | HttpError, _req, reply) => {
    if (err instanceof HttpError) {
      return reply.code(err.status).send({ error: err.message.toLowerCase(), code: err.code });
    }
    // Preserve Fastify's own 4xx (malformed JSON 400, unknown route 404) —
    // without this branch they would all be flattened to 500.
    if (err.statusCode && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: err.message.toLowerCase() });
    }
    return reply.code(500).send({ error: 'internal error', code: 'INTERNAL_ERROR' });
  });

  // Fastify's default 404 body doesn't go through setErrorHandler and isn't
  // in the house envelope shape — map it explicitly.
  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: 'not found' });
  });

  healthRoutes(app, connection);
  authRoutes(app, db);
  mechanicsRoutes(app, db);

  return app;
}
