'use client';

import { AnimatePresence } from 'motion/react';
import { TextField, TextAreaField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { SectionCard } from '@/components/ui/SectionCard';
import { AnimatedListItem } from '@/components/ui/AnimatedListItem';
import { useListField } from '@/lib/useListField';
import type { EducationEntry } from '@/lib/types';

const EMPTY: EducationEntry = {
  school: '',
  degree: '',
  field: '',
  start_date: '',
  end_date: '',
  gpa: '',
  notes: '',
};

export function EducationSection({
  value,
  onChange,
}: {
  value: EducationEntry[];
  onChange: (next: EducationEntry[]) => void;
}) {
  const { items, add, update, remove } = useListField(value, onChange);

  return (
    <SectionCard
      title="Education"
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
                    label="School"
                    value={entry.school}
                    onChange={(e) => update(i, { school: e.target.value })}
                  />
                  <TextField
                    label="Degree"
                    value={entry.degree}
                    onChange={(e) => update(i, { degree: e.target.value })}
                  />
                  <TextField
                    label="Field of study"
                    value={entry.field}
                    onChange={(e) => update(i, { field: e.target.value })}
                  />
                  <TextField
                    label="GPA"
                    value={entry.gpa}
                    onChange={(e) => update(i, { gpa: e.target.value })}
                  />
                  <TextField
                    label="Start"
                    placeholder="2020"
                    value={entry.start_date}
                    onChange={(e) => update(i, { start_date: e.target.value })}
                  />
                  <TextField
                    label="End"
                    placeholder="2024, or Present"
                    value={entry.end_date}
                    onChange={(e) => update(i, { end_date: e.target.value })}
                  />
                </div>
                <TextAreaField
                  label="Notes"
                  rows={2}
                  value={entry.notes}
                  onChange={(e) => update(i, { notes: e.target.value })}
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
          <p className="text-sm text-muted">No education added yet.</p>
        )}
      </div>
    </SectionCard>
  );
}
