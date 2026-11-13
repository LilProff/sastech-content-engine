export type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

export type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
};

// Free-tier availability on OpenRouter rotates — sanity-check against
// openrouter.ai/models?supported_parameters=tools if this list ever stops working.
const DEFAULT_MODELS = ['openrouter/free', 'qwen/qwen3-coder:free'];

export async function callOpenRouter({
  messages,
  tools,
  models = DEFAULT_MODELS,
  maxTokens = 1200,
}: {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  models?: string[];
  maxTokens?: number;
}): Promise<{ message: ChatMessage; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://career-os.vercel.app',
          'X-Title': 'Career OS Assistant',
        },
        body: JSON.stringify({
          model,
          messages,
          ...(tools ? { tools } : {}),
          max_tokens: maxTokens,
        }),
      });

      // Rate limited or out of credit on this model — try the next one.
      if (res.status === 429 || res.status === 402) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      if (!res.ok) continue;

      const data = await res.json();
      const message = data.choices?.[0]?.message;
      if (!message) continue;

      return { message, model };
    } catch {
      continue;
    }
  }

  throw new Error('All AI models exhausted. Try again later.');
}
