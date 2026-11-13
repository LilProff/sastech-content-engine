'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { getSupabaseClient, getAuthToken, safeQuery } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';

type DisplayMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
};

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-2">
      <span className="thinking-dot" />
      <span className="thinking-dot" />
      <span className="thinking-dot" />
    </div>
  );
}

function MessageBubble({ message, delay }: { message: DisplayMessage; delay: number }) {
  const reduceMotion = useReducedMotion();
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, transform: 'translateY(8px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      transition={{ duration: 0.2, ease: EASE_OUT, delay }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-accent text-accent-foreground'
              : 'border border-border bg-surface text-foreground'
          }`}
        >
          {message.content}
        </div>
        {message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <AnimatePresence>
              {message.toolsUsed.map((tool, i) => (
                <motion.span
                  key={tool + i}
                  initial={reduceMotion ? false : { opacity: 0, transform: 'translateY(4px)' }}
                  animate={{ opacity: 1, transform: 'translateY(0px)' }}
                  transition={{ duration: 0.18, ease: EASE_OUT, delay: i * 0.05 }}
                  className="rounded-full bg-surface-elevated px-2.5 py-0.5 text-[11px] text-muted"
                >
                  ✓ {tool.replace(/_/g, ' ')}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function ChatView() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const isInitialLoad = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const sb = getSupabaseClient();
      const { data, error } = await safeQuery(
        sb
          .from('chat_messages')
          .select('id, role, content')
          .in('role', ['user', 'assistant'])
          .order('created_at', { ascending: true })
      );

      if (error) {
        toast.error('Could not load your conversation history.', { description: error });
      } else {
        setMessages(
          (data ?? [])
            .filter((m) => m.content)
            .map((m) => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }))
        );
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: isInitialLoad.current ? 'auto' : 'smooth' });
    if (messages.length) isInitialLoad.current = false;
  }, [messages, sending]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;

    setDraft('');
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', content: text }]);
    setSending(true);

    try {
      const token = getAuthToken();
      const res = await fetch('/api/assistant-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'The assistant is unavailable right now.');

      const toolsUsed: string[] = (data.toolTrace ?? []).map((t: { name: string }) => t.name);
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}-reply`, role: 'assistant', content: data.reply, toolsUsed },
      ]);
    } catch (err) {
      toast.error('Message failed.', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col px-6">
      <div className="border-b border-border py-6">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Assistant</h1>
        <p className="mt-1 text-sm text-muted">
          Tell it what changed — a new project, a certification, a job you want to track.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-6">
        {loading ? (
          <p className="text-sm text-muted">Loading your conversation…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted">
            No messages yet. Say hello, or tell it about something you just finished.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <MessageBubble key={m.id} message={m} delay={isInitialLoad.current ? i * 0.04 : 0} />
            ))}
            {sending && <ThinkingIndicator />}
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-border py-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message the assistant…"
          rows={1}
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
        />
        <Button variant="primary" type="button" onClick={handleSend} disabled={sending || !draft.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
