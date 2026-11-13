'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { getSupabaseClient, getAuthToken, safeQuery } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { SectionCard } from '@/components/ui/SectionCard';

type CvVersionRow = {
  id: string;
  pdf_url: string;
  docx_url: string;
  is_master: boolean;
  created_at: string;
};

export function CvManager() {
  const searchParams = useSearchParams();
  const opportunityId = searchParams.get('opportunityId');
  const [opportunityTitle, setOpportunityTitle] = useState<string | null>(null);
  const [versions, setVersions] = useState<CvVersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<'pdf' | 'docx' | null>(null);

  useEffect(() => {
    if (!opportunityId) {
      setOpportunityTitle(null);
      return;
    }
    (async () => {
      const { data } = await safeQuery(
        getSupabaseClient().from('opportunities').select('title').eq('id', opportunityId).maybeSingle()
      );
      setOpportunityTitle(data?.title ?? null);
    })();
  }, [opportunityId]);

  async function loadVersions() {
    const sb = getSupabaseClient();
    const { data, error } = await safeQuery(
      sb
        .from('cv_versions')
        .select('id, pdf_url, docx_url, is_master, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
    );
    if (error) {
      toast.error('Could not load your CV history.', { description: error });
    } else {
      setVersions((data as CvVersionRow[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadVersions();
  }, []);

  async function handleGenerate(format: 'pdf' | 'docx') {
    setGenerating(format);
    try {
      const token = getAuthToken();
      const res = await fetch('/api/cv-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ format, opportunityId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate the CV.');

      toast.success(`${format.toUpperCase()} generated.`, {
        action: { label: 'Download', onClick: () => window.open(data.url, '_blank') },
      });
      await loadVersions();
    } catch (err) {
      toast.error('Generation failed.', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setGenerating(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted">Loading your CV history…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">CV</h1>
        <p className="mt-1 text-sm text-muted">
          {opportunityId
            ? `Tailoring for: ${opportunityTitle ?? '…'}`
            : 'Generated straight from your profile — regenerate any time it changes.'}
        </p>
      </div>

      <SectionCard title="Generate">
        <div className="flex gap-2">
          <Button
            variant="primary"
            type="button"
            onClick={() => handleGenerate('pdf')}
            disabled={generating !== null}
          >
            {generating === 'pdf' ? 'Generating…' : 'Generate PDF'}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => handleGenerate('docx')}
            disabled={generating !== null}
          >
            {generating === 'docx' ? 'Generating…' : 'Generate Word'}
          </Button>
        </div>
      </SectionCard>

      <div className="mt-5">
        <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">History</h2>
        {versions.length === 0 ? (
          <p className="text-sm text-muted">Nothing generated yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
              >
                <p className="text-xs text-muted">
                  {new Date(v.created_at).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
                <div className="flex gap-2">
                  {v.pdf_url && (
                    <a
                      href={v.pdf_url}
                      target="_blank"
                      rel="noopener"
                      className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-border-hover hover:text-foreground"
                    >
                      PDF
                    </a>
                  )}
                  {v.docx_url && (
                    <a
                      href={v.docx_url}
                      target="_blank"
                      rel="noopener"
                      className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-border-hover hover:text-foreground"
                    >
                      Word
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
