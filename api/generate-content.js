// Free model fallback chain — tries each until one works
// Updated 2026-05-02: verified working on OpenRouter
const FREE_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'minimax/minimax-m2.5:free',
  'openai/gpt-oss-20b:free',
];

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, model, max_tokens = 1200 } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY not set' });

  // Build model list: user-specified model first, then free fallbacks
  const models = model ? [model, ...FREE_MODELS] : FREE_MODELS;

  for (const m of models) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
          'HTTP-Referer': 'https://sastech-content-engine.vercel.app',
          'X-Title': 'Sastech Content Engine',
        },
        body: JSON.stringify({
          model: m,
          max_tokens,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      // Rate limited or out of tokens — wait briefly then try next model
      if (response.status === 429 || response.status === 402) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      const data = await response.json();
      if (!response.ok) continue; // try next model on any error

      const text = data.choices?.[0]?.message?.content || '';
      if (!text) continue;

      return res.status(200).json({ text, model: m, usage: data.usage });
    } catch (err) {
      continue; // network error — try next model
    }
  }

  return res.status(503).json({
    error: 'All AI models exhausted. Please try again later or check your OpenRouter credits.',
    code: 'ALL_MODELS_EXHAUSTED'
  });
}
