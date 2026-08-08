import 'dotenv/config'; // local-dev convenience only; no-op if vars are already set by the host
import { z } from 'zod';

/**
 * Single validated configuration source for this server. Every other module
 * imports `config` from here — no other module may read `process.env` (or
 * any other environment record) directly.
 */
const EnvSchema = z.object({
  DB_PATH: z.string().min(1, 'DB_PATH is required'),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRY_SECONDS: z.coerce.number().int().positive().default(2592000),
});

export type Config = z.infer<typeof EnvSchema>;

/**
 * Parses an arbitrary environment record into a validated Config. Takes an
 * explicit env record (rather than reading process.env internally) so tests
 * can exercise every branch without mutating the real process environment.
 */
export function loadConfig(env: Record<string, string | undefined>): Config {
  return EnvSchema.parse(env);
}

export const config: Config = loadConfig(process.env);
