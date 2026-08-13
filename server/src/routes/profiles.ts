import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import type { Db } from '../db/client.js';
import { profiles } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { profileUserColumns, serializeProfileUser } from './user.js';

const UpdateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
  })
  .strict();

export function profileRoutes(app: FastifyInstance, db: Db) {
  const authenticate = requireAuth(db);

  app.patch('/profiles/me', { preHandler: authenticate }, async (request) => {
    const parsed = UpdateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, 'invalid request body', 'VALIDATION_FAILED');
    }

    const userId = request.user!.sub;
    db.update(profiles).set({ name: parsed.data.name }).where(eq(profiles.id, userId)).run();

    const row = db.select(profileUserColumns).from(profiles).where(eq(profiles.id, userId)).get();
    if (!row) {
      throw new HttpError(401, 'unauthorized', 'UNAUTHENTICATED');
    }

    return serializeProfileUser(row);
  });
}
