'use client';

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { getSupabaseClient, getUserId, getAuthToken, safeQuery } from '@/lib/supabaseClient';
import type { DocumentRow } from '@/lib/types';
import { StatusBadge } from './StatusBadge';
import { Button } from '@/components/ui/Button';

const DOC_TYPES: DocumentRow['doc_type'][] = [
  'other',
  'cv',
  'transcript',
  'certificate',
  'id',
  'cover_letter',
  'recommendation',
];

const ACCEPTED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsManager() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    const sb = getSupabaseClient();
    const { data, error } = await safeQuery(
      sb
        .from('documents')
        .select('id, source, file_name, mime_type, storage_path, extraction_status, doc_type, size_bytes, created_at')
        .order('created_at', { ascending: false })
    );
    if (error) {
      toast.error('Could not load your documents.', { description: error });
    } else {
      setDocuments((data as DocumentRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  async function uploadFiles(files: FileList | File[]) {
    const userId = getUserId();
    if (!userId) {
      toast.error('Your session looks stale — sign out and back in.');
      return;
    }

    setUploading(true);
    const sb = getSupabaseClient();

    for (const file of Array.from(files)) {
      if (!ACCEPTED_MIME.has(file.type)) {
        toast.error(`${file.name}: only PDF and Word (.docx) files are supported right now.`);
        continue;
      }

      const path = `${userId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await safeQuery(sb.storage.from('documents').upload(path, file));
      if (uploadError) {
        toast.error(`Upload failed for ${file.name}`, { description: uploadError });
        continue;
      }

      const { data: row, error: insertError } = await safeQuery(
        sb
          .from('documents')
          .insert({
            file_name: file.name,
            mime_type: file.type,
            storage_path: path,
            size_bytes: file.size,
            source: 'upload',
          })
          .select('id')
          .single()
      );

      if (insertError || !row) {
        toast.error(`Could not save ${file.name}`, { description: insertError ?? undefined });
        continue;
      }

      await loadDocuments();

      const token = getAuthToken();
      fetch('/api/documents-extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ documentId: row.id }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Extraction failed');
          await loadDocuments();
        })
        .catch((err) => {
          toast.error(`Could not read ${file.name}`, { description: err.message });
          loadDocuments();
        });
    }

    setUploading(false);
  }

  async function handleDelete(doc: DocumentRow) {
    const sb = getSupabaseClient();
    const { error: removeError } = await safeQuery(sb.storage.from('documents').remove([doc.storage_path]));
    if (removeError) {
      toast.error('Could not delete the file.', { description: removeError });
      return;
    }
    const { error: deleteError } = await safeQuery(sb.from('documents').delete().eq('id', doc.id));
    if (deleteError) {
      toast.error('Could not remove the document record.', { description: deleteError });
      return;
    }
    toast.success(`Removed ${doc.file_name}`);
    loadDocuments();
  }

  async function handleDocTypeChange(doc: DocumentRow, docType: DocumentRow['doc_type']) {
    setDocuments((docs) => docs.map((d) => (d.id === doc.id ? { ...d, doc_type: docType } : d)));
    const sb = getSupabaseClient();
    const { error } = await safeQuery(sb.from('documents').update({ doc_type: docType }).eq('id', doc.id));
    if (error) toast.error('Could not update the document type.');
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted">Loading your documents…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Documents</h1>
        <p className="mt-1 text-sm text-muted">
          Upload your CV, transcripts, and certificates — the Assistant reads these to fill in gaps.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`mb-8 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-border-hover'
        }`}
      >
        <p className="text-sm font-medium text-foreground">
          {uploading ? 'Uploading…' : 'Drop a file here, or click to browse'}
        </p>
        <p className="mt-1 text-xs text-muted">PDF or Word (.docx)</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {documents.length === 0 ? (
        <p className="text-center text-sm text-muted">No documents yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{doc.file_name}</p>
                <p className="text-xs text-muted">{formatSize(doc.size_bytes)}</p>
              </div>
              <select
                value={doc.doc_type}
                onChange={(e) => handleDocTypeChange(doc, e.target.value as DocumentRow['doc_type'])}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace('_', ' ')}
                  </option>
                ))}
              </select>
              <StatusBadge status={doc.extraction_status} />
              <Button variant="danger" type="button" onClick={() => handleDelete(doc)} className="px-2.5">
                ✕
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
