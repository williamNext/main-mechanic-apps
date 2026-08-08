import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { hashPassword } from '../auth/hash.js';
import { signAccessToken } from '../auth/jwt.js';
import type { Db } from '../db/client.js';
import { profiles } from '../db/schema.js';

// Unknown keys (including a client-supplied `role`) are stripped by zod's
// default "strip" behavior — they never reach the insert (D-07, T-01-03).
const SignupSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    (err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

export function authRoutes(app: FastifyInstance, db: Db) {
  app.post('/auth/signup', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = SignupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid request body' });
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await hashPassword(password);
    const id = randomUUID();

    try {
      db.insert(profiles)
        .values({
          id,
          name,
          email: normalizedEmail,
          role: 'client', // D-07: signup never honors a client-supplied role
          passwordHash,
        })
        .run();
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return reply.code(409).send({ error: 'email already registered' });
      }
      throw err;
    }

    const { token } = signAccessToken({ userId: id, role: 'client' });

    return reply.code(201).send({
      token,
      user: { id, name, email: normalizedEmail, role: 'client' },
    });
  });
}
