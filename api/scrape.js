// Real lead scraping via Serper.dev (Google Maps) + AI enrichment
// Free: 2,500 searches at serper.dev

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { service, query } = req.body;

  // ── Serper.dev Google Maps Search (REAL businesses) ──
  if (service === 'serper_maps') {
    const key = process.env.SERPER_API_KEY;
    if (!key) return res.status(500).json({ error: 'SERPER_API_KEY not set. Get free key at serper.dev' });

    try {
      const searchQuery = query.search || `${query.industry} in ${query.location}`;
      const r = await fetch('https://google.serper.dev/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
        body: JSON.stringify({
          q: searchQuery,
          gl: query.country_code || 'ng',
          hl: 'en',
          num: query.limit || 20,
        }),
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data });

      // Transform results into lead format
      const leads = (data.places || []).map(place => ({
        business_name: place.title || '',
        address: place.address || '',
        phone: place.phoneNumber || '',
        website: place.website || '',
        rating: place.rating || null,
        reviews: place.ratingCount || 0,
        category: place.category || '',
        latitude: place.latitude || null,
        longitude: place.longitude || null,
        cid: place.cid || '',
        position: place.position || 0,
      }));

      return res.status(200).json({ results: leads, total: leads.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Serper.dev Web Search (find people, LinkedIn profiles) ──
  if (service === 'serper_search') {
    const key = process.env.SERPER_API_KEY;
    if (!key) return res.status(500).json({ error: 'SERPER_API_KEY not set' });

    try {
      const r = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
        body: JSON.stringify({
          q: query.search,
          gl: query.country_code || 'ng',
          num: query.limit || 10,
        }),
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data });

      return res.status(200).json({
        results: (data.organic || []).map(r => ({
          title: r.title,
          link: r.link,
          snippet: r.snippet,
        })),
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Apollo.io (optional paid upgrade) ──
  if (service === 'apollo') {
    const key = process.env.APOLLO_API_KEY;
    if (!key) return res.status(500).json({ error: 'APOLLO_API_KEY not set' });
    try {
      const r = await fetch('https://api.apollo.io/v1/mixed_people/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify({
          person_titles: query.titles || [],
          person_locations: query.locations || ['Nigeria'],
          per_page: query.limit || 10,
        }),
      });
      const data = await r.json();
      return res.status(200).json({ results: data.people || [] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Hunter.io (optional) ──
  if (service === 'hunter') {
    const key = process.env.HUNTER_API_KEY;
    if (!key) return res.status(500).json({ error: 'HUNTER_API_KEY not set' });
    try {
      const r = await fetch(
        `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(query.domain)}&api_key=${key}`
      );
      const data = await r.json();
      return res.status(200).json({ results: data.data?.emails || [] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Unknown service. Use serper_maps, serper_search, apollo, or hunter.' });
}
