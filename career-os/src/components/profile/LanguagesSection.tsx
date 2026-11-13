'use client';

import { useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { SectionCard } from '@/components/ui/SectionCard';

export function LanguagesSection({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const reduceMotion = useReducedMotion();

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed]);
    setDraft('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <SectionCard title="Languages">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 focus-within:border-accent">
        <AnimatePresence initial={false}>
          {value.map((lang) => (
            <motion.span
              key={lang}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated px-3 py-1 text-sm text-foreground"
            >
              {lang}
              <button
                type="button"
                onClick={() => onChange(value.filter((l) => l !== lang))}
                className="text-muted hover:text-danger"
                aria-label={`Remove ${lang}`}
              >
                ✕
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={value.length ? '' : 'Type a language, press Enter'}
          className="min-w-[8rem] flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </div>
    </SectionCard>
  );
}
