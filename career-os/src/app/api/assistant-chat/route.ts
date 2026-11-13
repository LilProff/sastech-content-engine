import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callOpenRouter, type ChatMessage } from '@/lib/openrouter';
import { ASSISTANT_TOOLS, executeTool } from '@/lib/assistantTools';

export const maxDuration = 60;
const MAX_TOOL_ITERATIONS = 6;
const HISTORY_LIMIT = 30;

const SYSTEM_PROMPT = `You are the assistant inside Career OS, a personal career and portfolio management tool.
You have tools to read and update the user's profile, search their uploaded documents, and manage the opportunities (jobs, internships, scholarships) they're tracking.
When the user mentions a new project, skill, job, certification, or achievement, actually call update_profile to save it — don't just acknowledge it in text.
Keep replies concise and conversational. Never invent facts about the user's history; if you're unsure, call search_documents or ask a clarifying question instead of guessing.`;

type ToolTraceEntry = { name: string; args: unknown; result: unknown };

export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const userMessage = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!userMessage) {
    return Response.json({ error: 'message is required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: history } = await admin
    .from('chat_messages')
    .select('role, content, tool_calls, tool_call_id, tool_name')
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: true })
    .limit(HISTORY_LIMIT);

  await admin
    .from('chat_messages')
    .insert({ user_id: auth.userId, role: 'user', content: userMessage });

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(history ?? []).map(
      (m): ChatMessage => ({
        role: m.role as ChatMessage['role'],
        content: m.content,
        tool_calls: m.tool_calls ?? undefined,
        tool_call_id: m.tool_call_id ?? undefined,
        name: m.tool_name ?? undefined,
      })
    ),
    { role: 'user', content: userMessage },
  ];

  const toolTrace: ToolTraceEntry[] = [];

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const { message } = await callOpenRouter({ messages, tools: ASSISTANT_TOOLS });

      if (!message.tool_calls || message.tool_calls.length === 0) {
        await admin.from('chat_messages').insert({
          user_id: auth.userId,
          role: 'assistant',
          content: message.content ?? '',
        });
        return Response.json({ reply: message.content ?? '', toolTrace });
      }

      messages.push(message);
      await admin.from('chat_messages').insert({
        user_id: auth.userId,
        role: 'assistant',
        content: message.content ?? '',
        tool_calls: message.tool_calls,
      });

      for (const call of message.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || '{}');
        } catch {
          // Malformed JSON from the model — proceed with empty args, the tool will report what's missing.
        }

        const result = await executeTool(call.function.name, args, auth.userId);
        toolTrace.push({ name: call.function.name, args, result });

        const toolContent = JSON.stringify(result);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.function.name,
          content: toolContent,
        });
        await admin.from('chat_messages').insert({
          user_id: auth.userId,
          role: 'tool',
          content: toolContent,
          tool_call_id: call.id,
          tool_name: call.function.name,
        });
      }
    }

    return Response.json({
      reply: "I've hit my step limit for this turn — try asking again, maybe in smaller steps.",
      toolTrace,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'The assistant is unavailable right now.' },
      { status: 502 }
    );
  }
}
