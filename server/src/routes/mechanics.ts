import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/middleware.js';
import type { Db } from '../db/client.js';
import { publicMechanics } from '../db/schema.js';
import { HttpError } from '../errors.js';

const publicMechanicColumns = {
  id: publicMechanics.id,
  name: publicMechanics.name,
  specialty: publicMechanics.specialty,
  avatarUrl: publicMechanics.avatarUrl,
  updatedAt: publicMechanics.updatedAt,
};

const mechanicNotFound = () => new HttpError(404, 'mechanic not found', 'MECHANIC_NOT_FOUND');

export function mechanicsRoutes(app: FastifyInstance, db: Db) {
  const authenticate = requireAuth(db);

  app.get('/mechanics', { preHandler: authenticate }, async () => {
    return db.select(publicMechanicColumns).from(publicMechanics).orderBy(asc(publicMechanics.name)).all();
  });

  app.get<{ Params: { id: string } }>('/mechanics/:id', { preHandler: authenticate }, async (request) => {
    const row = db
      .select(publicMechanicColumns)
      .from(publicMechanics)
      .where(eq(publicMechanics.id, request.params.id))
      .get();

    if (!row) {
      throw mechanicNotFound();
    }

    return row;
  });
}
