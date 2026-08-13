import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/middleware.js';
import type { Db } from '../db/client.js';
import { notifications } from '../db/schema.js';
import { HttpError } from '../errors.js';

const notificationColumns = {
  id: notifications.id,
  recipientId: notifications.recipientId,
  appointmentId: notifications.appointmentId,
  type: notifications.type,
  title: notifications.title,
  body: notifications.body,
  readAt: notifications.readAt,
  createdAt: notifications.createdAt,
};

const notificationNotFound = () => new HttpError(404, 'notification not found', 'NOTIFICATION_NOT_FOUND');
const currentTimestamp = sql<string>`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export function notificationRoutes(app: FastifyInstance, db: Db) {
  const authenticate = requireAuth(db);

  app.get('/notifications', { preHandler: authenticate }, async (request) => {
    return db
      .select(notificationColumns)
      .from(notifications)
      .where(eq(notifications.recipientId, request.user!.sub))
      .orderBy(desc(notifications.createdAt))
      .limit(50)
      .all();
  });

  app.get('/notifications/unread-count', { preHandler: authenticate }, async (request) => {
    const row = db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.recipientId, request.user!.sub), isNull(notifications.readAt)))
      .get();

    return { count: row?.count ?? 0 };
  });

  app.post('/notifications/read-all', { preHandler: authenticate }, async (request, reply) => {
    db.update(notifications)
      .set({ readAt: currentTimestamp })
      .where(and(eq(notifications.recipientId, request.user!.sub), isNull(notifications.readAt)))
      .run();

    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>(
    '/notifications/:id/read',
    { preHandler: authenticate },
    async (request, reply) => {
      const owned = db
        .select({ readAt: notifications.readAt })
        .from(notifications)
        .where(and(eq(notifications.id, request.params.id), eq(notifications.recipientId, request.user!.sub)))
        .get();

      if (!owned) {
        throw notificationNotFound();
      }

      if (owned.readAt === null) {
        db.update(notifications)
          .set({ readAt: currentTimestamp })
          .where(
            and(
              eq(notifications.id, request.params.id),
              eq(notifications.recipientId, request.user!.sub),
              isNull(notifications.readAt),
            ),
          )
          .run();
      }

      return reply.code(204).send();
    },
  );
}
