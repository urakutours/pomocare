import { neon } from '@neondatabase/serverless';
import type { Env } from '../types';

/**
 * Create a SQL tagged-template function connected to Neon.
 * Each request gets its own lightweight connection (HTTP-based, no WebSocket).
 */
export function getSQL(env: Env) {
  return neon(env.NEON_DATABASE_URL);
}
