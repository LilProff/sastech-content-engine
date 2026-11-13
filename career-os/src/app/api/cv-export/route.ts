import { requireAuth } from '@/lib/auth';
import { generateAndStoreCv } from '@/lib/cvBuilder';

export const maxDuration = 30;

export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const format = body?.format;
  const opportunityId = typeof body?.opportunityId === 'string' ? body.opportunityId : null;
  if (format !== 'pdf' && format !== 'docx') {
    return Response.json({ error: "format must be 'pdf' or 'docx'" }, { status: 400 });
  }

  try {
    const result = await generateAndStoreCv(auth.userId, format, opportunityId);
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Could not generate the CV file.' },
      { status: 500 }
    );
  }
}
