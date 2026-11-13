import 'server-only';
import jwt from 'jsonwebtoken';

/** Verifies the caller's JWT (minted by /api/auth-login) before a route touches service-role data. */
export function requireAuth(request: Request): { userId: string } | null {
  const header = request.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!) as { sub: string };
    return { userId: payload.sub };
  } catch {
    return null;
  }
}
