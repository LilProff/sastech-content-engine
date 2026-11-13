'use client';

import { AnimatePresence } from 'motion/react';
import { TextField, TextAreaField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { SectionCard } from '@/components/ui/SectionCard';
import { AnimatedListItem } from '@/components/ui/AnimatedListItem';
import { useListField } from '@/lib/useListField';
import type { WorkHistoryEntry } from '@/lib/types';

const EMPTY: WorkHistoryEntry = {
  company: '',
  title: '',
  start_date: '',
  end_date: '',
  current: false,
  description: '',
  achievements: [],
};

export function WorkHistorySection({
  value,
  onChange,
}: {
  value: WorkHistoryEntry[];
  onChange: (next: WorkHistoryEntry[]) => void;
}) {
  const { items, add, update, remove } = useListField(value, onChange);

  return (
    <SectionCard
      title="Work history"
      action={
        <Button variant="ghost" type="button" onClick={() => add(EMPTY)}>
          + Add
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <AnimatePresence initial={false}>
          {items.map((entry, i) => (
            <AnimatedListItem key={i}>
              <div className="rounded-xl border border-border p-4">
                <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField
                    label="Company"
                    value={entry.company}
                    onChange={(e) => update(i, { company: e.target.value })}
                  />
                  <TextField
                    label="Title"
                    value={entry.title}
                    onChange={(e) => update(i, { title: e.target.value })}
                  />
                  <TextField
                    label="Start"
                    placeholder="Jan 2023"
                    value={entry.start_date}
                    onChange={(e) => update(i, { start_date: e.target.value })}
                  />
                  <TextField
                    label="End"
                    placeholder="Present"
                    value={entry.end_date}
                    disabled={entry.current}
                    onChange={(e) => update(i, { end_date: e.target.value })}
                  />
                </div>

                <label className="mb-3 flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={entry.current}
                    onChange={(e) =>
                      update(i, {
                        current: e.target.checked,
                        end_date: e.target.checked ? 'Present' : '',
                      })
                    }
                    className="h-4 w-4 rounded border-border accent-[var(--accent)]"
                  />
                  I currently work here
                </label>

                <TextAreaField
                  label="Description"
                  rows={2}
                  className="mb-3"
                  value={entry.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                />

                <TextAreaField
                  label="Achievements (one per line)"
                  rows={3}
                  placeholder={'Shipped X, cutting Y by 30%\nLed a team of 3 engineers'}
                  value={entry.achievements.join('\n')}
                  onChange={(e) =>
                    update(i, { achievements: e.target.value.split('\n') })
                  }
                />

                <div className="mt-3 flex justify-end">
                  <Button variant="danger" type="button" onClick={() => remove(i)}>
                    Remove
                  </Button>
                </div>
              </div>
            </AnimatedListItem>
          ))}
        </AnimatePresence>
        {items.length === 0 && (
          <p className="text-sm text-muted">No work history added yet.</p>
        )}
      </div>
    </SectionCard>
  );
}
