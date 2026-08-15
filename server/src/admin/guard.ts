import type { Db } from '../db/client.js';
import { requireAuth, requireRole } from '../auth/middleware.js';

export function requireAdmin(db: Db) {
  return [requireAuth(db), requireRole(db, 'admin')];
}
