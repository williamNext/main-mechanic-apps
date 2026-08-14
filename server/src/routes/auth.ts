import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { revokeToken } from '../auth/blocklist.js';
import { hashPassword, verifyPassword } from '../auth/hash.js';
import { signAccessToken } from '../auth/jwt.js';
import { requireAuth } from '../auth/middleware.js';
import type { Db } from '../db/client.js';
import { mechanics, profiles } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { profileUserColumns, serializeProfileUser } from './user.js';

// Unknown keys (including a client-supplied `role`) are stripped by zod's
// default "strip" behavior — they never reach the insert (D-07, T-01-03).
const SignupSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

const LoginSchema = z.object({
  // .trim() runs before .email() so surrounding whitespace never fails
  // validation — the handler still normalizes (trim + lowercase) again
  // before lookup, matching how signup stored the email.
  email: z.string().trim().email(),
  password: z.string().min(1),
});

// One shared, identically-constructed response for both login failure
// paths — unknown email and known email/wrong password — so a caller
// cannot use the response body to tell which was wrong (T-03-04).
const invalidLogin = () => new HttpError(401, 'invalid email or password', 'INVALID_CREDENTIALS');

/**
 * A fixed dummy argon2id hash, generated once at module load rather than
 * per request. The unknown-email login path verifies the submitted
 * password against THIS hash instead of returning early, so an unknown
 * email costs roughly the same wall-clock time as a known one with a wrong
 * password — otherwise response timing alone would answer whether an
 * address is registered even though the response body does not.
 */
const DUMMY_PASSWORD_HASH = await hashPassword('dummy-password-never-a-real-account-timing-parity');

function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    (err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

export function authRoutes(app: FastifyInstance, db: Db) {
  // A single shared instance so /auth/me and /auth/logout (and every
  // future authenticated route in this project) pick up the same
  // signature-then-revocation check by using this one preHandler.
  const authenticate = requireAuth(db);

  app.post('/auth/signup', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = SignupSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, 'invalid request body', 'VALIDATION_FAILED');
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
        throw new HttpError(409, 'email already registered', 'EMAIL_TAKEN');
      }
      throw err;
    }

    const { token } = signAccessToken({ userId: id, role: 'client' });

    return reply.code(201).send({
      token,
      user: serializeProfileUser({
        id,
        name,
        email: normalizedEmail,
        role: 'client',
        phone: null,
        avatarUrl: null,
        specialty: null,
      }),
    });
  });

  app.post('/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, 'invalid request body', 'VALIDATION_FAILED');
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const row = db
      .select({ ...profileUserColumns, passwordHash: profiles.passwordHash })
      .from(profiles)
      .leftJoin(mechanics, eq(mechanics.id, profiles.id))
      .where(eq(profiles.email, normalizedEmail))
      .get();

    // Always verify a password, even when the email lookup misses — against
    // the real hash when the row exists, against the module-level dummy
    // hash when it doesn't — so the two failure paths cost the same
    // wall-clock time (T-03-04). Never short-circuit on a missing row.
    const passwordValid = await verifyPassword(row?.passwordHash ?? DUMMY_PASSWORD_HASH, password);

    if (!row || !passwordValid) {
      throw invalidLogin();
    }

    // The role in the token and in the response comes from the stored
    // profile row and from nowhere else (T-03-07).
    const { token } = signAccessToken({ userId: row.id, role: row.role });

    return reply.code(200).send({
      token,
      user: serializeProfileUser(row),
    });
  });

  app.get(
    '/auth/me',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Read the profile fresh by the token's subject rather than echoing
      // the token payload, so a profile that has changed since the token
      // was issued reports its current state (T-03-08).
      const userId = request.user!.sub;
      const row = db
        .select(profileUserColumns)
        .from(profiles)
        .leftJoin(mechanics, eq(mechanics.id, profiles.id))
        .where(eq(profiles.id, userId))
        .get();

      if (!row) {
        throw new HttpError(401, 'unauthorized', 'UNAUTHENTICATED');
      }

      return reply.send(serializeProfileUser(row));
    },
  );

  app.post(
    '/auth/logout',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // A caller must present a currently-valid token to end it — the
      // preHandler above already rejected a missing, forged, or
      // already-revoked token with 401 before this handler ever runs,
      // which is why presenting an already-revoked token on THIS route
      // also returns 401 rather than a second success: logout is not
      // idempotent at the HTTP layer even though revokeToken beneath it is.
      const { jti, exp } = request.user!;
      revokeToken(db, { jti, exp });

      return reply.code(204).send();
    },
  );
}
