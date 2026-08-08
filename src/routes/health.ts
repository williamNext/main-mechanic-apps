import type { FastifyInstance } from 'fastify';
import type { Connection } from '../db/client.js';

/**
 * GET /health — runs a live database probe (SELECT 1) rather than just
 * returning a static 200, so a broken DB connection is visible immediately.
 */
export function healthRoutes(app: FastifyInstance, connection: Connection) {
  app.get('/health', async () => {
    connection.prepare('SELECT 1').get();
    return { status: 'ok', db: 'ok' };
  });
}
