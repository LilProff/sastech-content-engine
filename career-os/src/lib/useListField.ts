import { useCallback } from 'react';

export function useListField<T>(value: T[], onChange: (next: T[]) => void) {
  const add = useCallback((item: T) => onChange([...value, item]), [value, onChange]);

  const update = useCallback(
    (index: number, patch: Partial<T>) =>
      onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item))),
    [value, onChange]
  );

  const remove = useCallback(
    (index: number) => onChange(value.filter((_, i) => i !== index)),
    [value, onChange]
  );

  return { items: value, add, update, remove };
}
