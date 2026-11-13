'use client';

import { AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { SectionCard } from '@/components/ui/SectionCard';
import { AnimatedListItem } from '@/components/ui/AnimatedListItem';
import { useListField } from '@/lib/useListField';
import type { CertificationEntry } from '@/lib/types';

const EMPTY: CertificationEntry = { name: '', issuer: '', date: '', credential_url: '' };

export function CertificationsSection({
  value,
  onChange,
}: {
  value: CertificationEntry[];
  onChange: (next: CertificationEntry[]) => void;
}) {
  const { items, add, update, remove } = useListField(value, onChange);

  return (
    <SectionCard
      title="Certifications"
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
                  placeholder="Certification"
                  className="min-w-0 flex-[2] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
                />
                <input
                  value={entry.issuer}
                  onChange={(e) => update(i, { issuer: e.target.value })}
                  placeholder="Issuer"
                  className="min-w-0 flex-[1.5] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
                />
                <input
                  value={entry.date}
                  onChange={(e) => update(i, { date: e.target.value })}
                  placeholder="2024"
                  className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
                />
                <input
                  value={entry.credential_url}
                  onChange={(e) => update(i, { credential_url: e.target.value })}
                  placeholder="Credential URL"
                  className="min-w-0 flex-[2] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
                />
                <Button variant="danger" type="button" onClick={() => remove(i)} className="px-2.5">
                  ✕
                </Button>
              </div>
            </AnimatedListItem>
          ))}
        </AnimatePresence>
        {items.length === 0 && (
          <p className="text-sm text-muted">No certifications added yet.</p>
        )}
      </div>
    </SectionCard>
  );
}
