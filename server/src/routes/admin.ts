import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../admin/guard.js';
import { runImmediateTransaction } from '../appointments/transactions.js';
import { hashPassword } from '../auth/hash.js';
import type { Db } from '../db/client.js';
import { mechanics, profiles } from '../db/schema.js';
import { HttpError } from '../errors.js';

const CreateMechanicSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  specialty: z.string().trim().min(1),
  credentials: z.string().trim().min(1),
  isActive: z.unknown().optional(),
}).strict();

type AdminMechanicResponse = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  specialty: string;
  credentials: string;
  isActive: boolean;
};

function isProfilesEmailUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE' &&
    error.message.includes('profiles.email')
  );
}

export function adminRoutes(app: FastifyInstance, db: Db) {
  app.post('/admin/mechanics', { preHandler: requireAdmin(db) }, async (request, reply) => {
    const parsed = CreateMechanicSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, 'invalid request body', 'VALIDATION_FAILED');
    }

    const { name, phone, email, password, specialty, credentials } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    const passwordHash = await hashPassword(password);
    const id = randomUUID();

    try {
      const created = runImmediateTransaction<AdminMechanicResponse>(db, (tx) => {
        const profile = tx
          .insert(profiles)
          .values({ id, name, email: normalizedEmail, role: 'mechanic', phone, passwordHash })
          .returning({
            id: profiles.id,
            name: profiles.name,
            email: profiles.email,
            phone: profiles.phone,
            avatarUrl: profiles.avatarUrl,
            createdAt: profiles.createdAt,
          })
          .get();

        const mechanic = tx
          .insert(mechanics)
          .values({ id, specialty, credentials, isActive: true })
          .returning({
            specialty: mechanics.specialty,
            credentials: mechanics.credentials,
            isActive: mechanics.isActive,
          })
          .get();

        return { ...profile, ...mechanic };
      });

      return reply.code(201).send(created);
    } catch (error) {
      if (isProfilesEmailUniqueConstraintError(error)) {
        throw new HttpError(409, 'email already registered', 'EMAIL_TAKEN');
      }
      throw error;
    }
  });
}
