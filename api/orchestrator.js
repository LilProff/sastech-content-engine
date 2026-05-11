// Vercel Serverless Function: Jarvis Orchestrator
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { category, raw_update } = req.body;
  if (!raw_update) return res.status(400).json({ error: 'raw_update is required' });

  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY not set' });

  // Fallback Free Models
  const FREE_MODELS = [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemma-3-27b-it:free'
  ];

  // ─── MOCK N8N WEBHOOK URLS ───
  // Replace these with your actual n8n Webhook URLs once set up
  const N8N_WEBHOOKS = {
    "DocUpdater": "https://your-n8n-url.com/webhook/doc-updater",
    "ContentPublisher": "https://your-n8n-url.com/webhook/content-publisher",
    "PortfolioSyncer": "https://your-n8n-url.com/webhook/portfolio-syncer",
    "JobApplicator": "https://your-n8n-url.com/webhook/job-applicator"
  };

  const systemPrompt = `You are Jarvis, the orchestrator agent for Sastech.
Analyze the user's raw update and output a JSON array of automated tasks that your sub-agents should execute.
Task formats must be EXACTLY:
- {"agent": "DocUpdater", "action": "Rewrite CV to include new skill/project", "details": "..."}
- {"agent": "ContentPublisher", "action": "Draft LinkedIn Post", "details": "..."}
- {"agent": "PortfolioSyncer", "action": "Add case study to website", "details": "..."}
- {"agent": "JobApplicator", "action": "Search remote jobs matching new skill", "details": "..."}

Return ONLY the valid JSON array. Do not include markdown formatting or any other text.`;

  const userPrompt = `Category: ${category}\nRaw Update: ${raw_update}\nIdentify automated actions.`;

  let content = null;

  // Call OpenRouter API
  for (const model of FREE_MODELS) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
          'HTTP-Referer': 'https://sastech-content-engine.vercel.app',
          'X-Title': 'Sastech Orchestrator',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {"role": "system", "content": systemPrompt},
            {"role": "user", "content": userPrompt}
          ]
        }),
      });

      if (response.status === 429 || response.status === 402) continue; // Try next free model on rate limit
      if (!response.ok) continue;

      const data = await response.json();
      content = data.choices?.[0]?.message?.content;
      if (content) break;
    } catch (e) {
      console.error(`Model ${model} failed: ${e}`);
    }
  }

  if (!content) {
    return res.status(503).json({ error: "All AI models failed or rate limited." });
  }

  // Parse JSON
  let tasks = [];
  try {
    tasks = JSON.parse(content.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
  } catch (e) {
    return res.status(500).json({ error: "Failed to parse LLM output into JSON tasks.", raw_output: content });
  }

  // Dispatch to Sub-Agents (Simulated Webhook Calls)
  const dispatch_results = [];
  for (const task of tasks) {
    const agent = task.agent;
    if (N8N_WEBHOOKS[agent]) {
      // In production:
      // await fetch(N8N_WEBHOOKS[agent], { method: 'POST', body: JSON.stringify(task) });
      dispatch_results.push({"agent": agent, "status": "Dispatched", "details": task.details});
    } else {
      dispatch_results.push({"agent": agent, "status": "Failed - Unknown Agent", "details": task.details});
    }
  }

  return res.status(200).json({ status: "success", tasks_executed: dispatch_results });
}
