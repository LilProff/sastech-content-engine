import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export async function POST(request: Request) {
  const { APP_PASSWORD, SUPABASE_JWT_SECRET, APP_USER_ID } = process.env;
  if (!APP_PASSWORD || !SUPABASE_JWT_SECRET || !APP_USER_ID) {
    return Response.json(
      { error: 'Server not configured yet. Set APP_PASSWORD, SUPABASE_JWT_SECRET, and APP_USER_ID.' },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({ password: '' }));
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) {
    return Response.json({ error: 'Password is required' }, { status: 400 });
  }

  const given = Buffer.from(password);
  const expected = Buffer.from(APP_PASSWORD);
  const match = given.length === expected.length && crypto.timingSafeEqual(given, expected);
  if (!match) {
    return Response.json({ error: 'Wrong password' }, { status: 401 });
  }

  const token = jwt.sign(
    { sub: APP_USER_ID, role: 'authenticated' },
    SUPABASE_JWT_SECRET,
    { expiresIn: '30d' }
  );

  return Response.json({ token });
}
