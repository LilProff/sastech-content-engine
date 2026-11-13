import type { DocumentRow } from '@/lib/types';

const LABELS: Record<DocumentRow['extraction_status'], string> = {
  pending: 'Processing…',
  ok: 'Indexed',
  failed: 'Failed',
  unsupported: 'Not readable',
};

const CLASSES: Record<DocumentRow['extraction_status'], string> = {
  pending: 'bg-surface-elevated text-muted',
  ok: 'bg-accent/15 text-accent',
  failed: 'bg-danger/15 text-danger',
  unsupported: 'bg-surface-elevated text-muted',
};

export function StatusBadge({ status }: { status: DocumentRow['extraction_status'] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${CLASSES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
