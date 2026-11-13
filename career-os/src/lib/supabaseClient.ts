import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const AUTH_TOKEN_KEY = 'career_os_token';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

/** Fresh client per call so it always carries the current token (RLS reads it from the JWT). */
export function getSupabaseClient() {
  const token = getAuthToken();
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

/**
 * Supabase-js normally reports failures as `{ error }` on the resolved result, but a
 * network-level failure (DNS, offline, CORS) rejects the promise instead — confirmed
 * directly in this app (an unreachable project URL throws, it doesn't resolve to
 * `{error}`). Every call site has to handle both shapes to fail gracefully instead of
 * getting stuck mid-load, so that logic lives here once instead of in every component.
 */
export async function safeQuery<T>(
  promise: PromiseLike<{ data: T; error: { message: string } | null }>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await promise;
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Reads the `sub` claim out of our own JWT (no verification needed — we already trust it,
 * it's the token we were issued). Used for things RLS can't default for us, like Storage
 * paths, which must be prefixed with the user's id for the storage.objects policy to match.
 */
export function getUserId(): string | null {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = window.atob(base64);
    const claims = JSON.parse(json) as { sub?: string };
    return typeof claims.sub === 'string' ? claims.sub : null;
  } catch {
    return null;
  }
}
