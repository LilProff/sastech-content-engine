// Free model fallback chain — tries each until one works
const FREE_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemma-3-4b-it:free',
  'mistralai/mistral-7b-instruct:free',
  'qwen/qwen3-4b:free',
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

      // Rate limited or out of tokens — try next model
      if (response.status === 429 || response.status === 402) continue;

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
