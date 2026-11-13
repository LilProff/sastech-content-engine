import { requireAuth } from '@/lib/auth';
import { scrapeUrl } from '@/lib/scrape';

export const maxDuration = 30;

export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === 'string' ? body.url : '';
  if (!url) {
    return Response.json({ error: 'url is required' }, { status: 400 });
  }

  try {
    const content = await scrapeUrl(url);
    return Response.json({ content });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Could not fetch that page.' },
      { status: 502 }
    );
  }
}
