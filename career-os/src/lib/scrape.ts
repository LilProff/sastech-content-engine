import 'server-only';

/**
 * Fetches readable page content via Serper's Scrape API (scrape.serper.dev) — a
 * different Serper endpoint than the old app's api/scrape.js (which hits
 * google.serper.dev for maps/search results), same X-API-KEY auth pattern.
 */
export async function scrapeUrl(url: string): Promise<string> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error('SERPER_API_KEY is not set');

  const res = await fetch('https://scrape.serper.dev', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) throw new Error(`Could not fetch that page (status ${res.status}).`);

  const data = await res.json();
  const content: string = data.text || data.markdown || '';
  if (!content) throw new Error('That page returned no readable content.');
  return content;
}
