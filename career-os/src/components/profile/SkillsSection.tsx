'use client';

import { AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { SectionCard } from '@/components/ui/SectionCard';
import { AnimatedListItem } from '@/components/ui/AnimatedListItem';
import { useListField } from '@/lib/useListField';
import type { SkillEntry } from '@/lib/types';

const EMPTY: SkillEntry = { name: '', category: '', level: '' };
const LEVELS = ['', 'Familiar', 'Comfortable', 'Strong', 'Expert'];

export function SkillsSection({
  value,
  onChange,
}: {
  value: SkillEntry[];
  onChange: (next: SkillEntry[]) => void;
}) {
  const { items, add, update, remove } = useListField(value, onChange);

  return (
    <SectionCard
      title="Skills"
      action={
        <Button variant="ghost" type="button" onClick={() => add(EMPTY)}>
          + Add
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {items.map((entry, i) => (
            <AnimatedListItem key={i}>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={entry.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="Skill"
                  className="min-w-0 flex-[2] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
                />
                <input
                  value={entry.category}
                  onChange={(e) => update(i, { category: e.target.value })}
                  placeholder="Category"
                  className="min-w-0 flex-[1.5] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
                />
                <select
                  value={entry.level}
                  onChange={(e) => update(i, { level: e.target.value })}
                  className="flex-1 rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l || 'Level'}
                    </option>
                  ))}
                </select>
                <Button variant="danger" type="button" onClick={() => remove(i)} className="px-2.5">
                  ✕
                </Button>
              </div>
            </AnimatedListItem>
          ))}
        </AnimatePresence>
        {items.length === 0 && <p className="text-sm text-muted">No skills added yet.</p>}
      </div>
    </SectionCard>
  );
}
