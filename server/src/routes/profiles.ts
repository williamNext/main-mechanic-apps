import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import type { Db } from '../db/client.js';
import { mechanics, profiles } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { profileUserColumns, serializeProfileUser } from './user.js';

export const UpdateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    specialty: z.string().trim().min(1).optional(),
  })
  .strict();

export function profileRoutes(app: FastifyInstance, db: Db) {
  const authenticate = requireAuth(db);

  app.patch('/profiles/me', { preHandler: authenticate }, async (request) => {
    const userId = request.user!.sub;
    const caller = db
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .get();
    if (!caller) {
      throw new HttpError(401, 'unauthorized', 'UNAUTHENTICATED');
    }

    const parsed = UpdateProfileSchema.safeParse(request.body);
    const specialtySupplied =
      typeof request.body === 'object' &&
      request.body !== null &&
      Object.prototype.hasOwnProperty.call(request.body, 'specialty');
    if (!parsed.success || (specialtySupplied && caller.role !== 'mechanic')) {
      throw new HttpError(400, 'invalid request body', 'VALIDATION_FAILED');
    }

    db.transaction((tx) => {
      tx.update(profiles).set({ name: parsed.data.name }).where(eq(profiles.id, userId)).run();
      if (caller.role === 'mechanic' && parsed.data.specialty !== undefined) {
        tx.update(mechanics).set({ specialty: parsed.data.specialty }).where(eq(mechanics.id, userId)).run();
      }
    });

    const row = db
      .select(profileUserColumns)
      .from(profiles)
      .leftJoin(mechanics, eq(mechanics.id, profiles.id))
      .where(eq(profiles.id, userId))
      .get();
    if (!row) {
      throw new HttpError(401, 'unauthorized', 'UNAUTHENTICATED');
    }

    return serializeProfileUser(row);
  });
}
