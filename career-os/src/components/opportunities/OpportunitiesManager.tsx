'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { getSupabaseClient, getAuthToken, safeQuery } from '@/lib/supabaseClient';
import type { Opportunity } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { SectionCard } from '@/components/ui/SectionCard';
import { AnimatedListItem } from '@/components/ui/AnimatedListItem';

const TYPES: Opportunity['opportunity_type'][] = ['job', 'internship', 'scholarship', 'grant', 'other'];
const STATUSES: Opportunity['status'][] = [
  'saved',
  'researching',
  'drafting',
  'applied',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
];

const STATUS_CLASSES: Record<Opportunity['status'], string> = {
  saved: 'bg-surface-elevated text-muted',
  researching: 'bg-surface-elevated text-muted',
  drafting: 'bg-accent/15 text-accent',
  applied: 'bg-accent/15 text-accent',
  interview: 'bg-accent/25 text-accent',
  offer: 'bg-accent text-accent-foreground',
  rejected: 'bg-danger/15 text-danger',
  withdrawn: 'bg-danger/15 text-danger',
};

const EMPTY_FORM = { title: '', org_name: '', opportunity_type: 'job' as Opportunity['opportunity_type'], source_url: '', deadline: '' };

export function OpportunitiesManager() {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  async function loadOpportunities() {
    const sb = getSupabaseClient();
    const { data, error } = await safeQuery(
      sb.from('opportunities').select('*').order('created_at', { ascending: false })
    );
    if (error) {
      toast.error('Could not load your opportunities.', { description: error });
    } else {
      setOpportunities((data as Opportunity[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadOpportunities();
  }, []);

  async function handleAdd() {
    if (!form.title.trim()) {
      toast.error('Give it a title first.');
      return;
    }
    setAdding(true);
    const sb = getSupabaseClient();
    const { error } = await safeQuery(
      sb.from('opportunities').insert({
        title: form.title.trim(),
        org_name: form.org_name.trim(),
        opportunity_type: form.opportunity_type,
        source_url: form.source_url.trim(),
        deadline: form.deadline || null,
      })
    );
    setAdding(false);
    if (error) {
      toast.error('Could not add it.', { description: error });
      return;
    }
    setForm(EMPTY_FORM);
    toast.success('Added.');
    loadOpportunities();
  }

  async function handleStatusChange(opp: Opportunity, status: Opportunity['status']) {
    setOpportunities((prev) => prev.map((o) => (o.id === opp.id ? { ...o, status } : o)));
    const sb = getSupabaseClient();
    const { error } = await safeQuery(sb.from('opportunities').update({ status }).eq('id', opp.id));
    if (error) toast.error('Could not update the status.', { description: error });
  }

  async function handleDelete(opp: Opportunity) {
    const sb = getSupabaseClient();
    const { error } = await safeQuery(sb.from('opportunities').delete().eq('id', opp.id));
    if (error) {
      toast.error('Could not remove it.', { description: error });
      return;
    }
    loadOpportunities();
  }

  async function handleAnalyze(opp: Opportunity) {
    if (!opp.source_url && !opp.fetched_content) {
      toast.error('Add a source URL first so there is something to analyze.');
      return;
    }
    setAnalyzingId(opp.id);
    try {
      const token = getAuthToken();
      const res = await fetch('/api/gap-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ opportunityId: opp.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed.');
      toast.success('Analysis ready.');
      loadOpportunities();
    } catch (err) {
      toast.error('Could not analyze this one.', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setAnalyzingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted">Loading your opportunities…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Opportunities</h1>
        <p className="mt-1 text-sm text-muted">
          Jobs, internships, and scholarships you're tracking — paste a link and see what you're missing.
        </p>
      </div>

      <SectionCard title="Add an opportunity">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <TextField
            label="Organization"
            value={form.org_name}
            onChange={(e) => setForm((f) => ({ ...f, org_name: e.target.value }))}
          />
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
              Type
            </span>
            <select
              value={form.opportunity_type}
              onChange={(e) =>
                setForm((f) => ({ ...f, opportunity_type: e.target.value as Opportunity['opportunity_type'] }))
              }
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Deadline"
            type="date"
            value={form.deadline}
            onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
          />
          <TextField
            label="Source URL"
            className="sm:col-span-2"
            placeholder="https://…"
            value={form.source_url}
            onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="primary" type="button" onClick={handleAdd} disabled={adding}>
            {adding ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </SectionCard>

      <div className="mt-5 flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {opportunities.map((opp) => (
            <AnimatedListItem key={opp.id}>
              <div className="rounded-2xl border border-border bg-surface p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{opp.title}</p>
                    <p className="text-xs text-muted">
                      {[opp.org_name, opp.opportunity_type].filter(Boolean).join('  ·  ')}
                      {opp.deadline && `  ·  due ${opp.deadline}`}
                    </p>
                  </div>
                  <select
                    value={opp.status}
                    onChange={(e) => handleStatusChange(opp, e.target.value as Opportunity['status'])}
                    className={`rounded-full border-0 px-2.5 py-1 text-[11px] font-medium outline-none ${STATUS_CLASSES[opp.status]}`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {opp.gap_analysis?.notes && (
                  <div className="mb-3 rounded-xl border border-border bg-background p-3">
                    {!!opp.gap_analysis.matched_skills?.length && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {opp.gap_analysis.matched_skills.map((s) => (
                          <span key={s} className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {!!opp.gap_analysis.missing_skills?.length && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {opp.gap_analysis.missing_skills.map((s) => (
                          <span key={s} className="rounded-full bg-danger/15 px-2 py-0.5 text-[11px] text-danger">
                            missing: {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs leading-relaxed text-muted">{opp.gap_analysis.notes}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {opp.source_url && (
                    <a
                      href={opp.source_url}
                      target="_blank"
                      rel="noopener"
                      className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
                    >
                      View posting ↗
                    </a>
                  )}
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => handleAnalyze(opp)}
                    disabled={analyzingId === opp.id}
                  >
                    {analyzingId === opp.id ? 'Analyzing…' : 'Analyze fit'}
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => router.push(`/cv?opportunityId=${opp.id}`)}
                  >
                    Tailor CV
                  </Button>
                  <Button variant="danger" type="button" onClick={() => handleDelete(opp)} className="px-2.5">
                    ✕
                  </Button>
                </div>
              </div>
            </AnimatedListItem>
          ))}
        </AnimatePresence>
        {opportunities.length === 0 && (
          <p className="text-center text-sm text-muted">Nothing tracked yet.</p>
        )}
      </div>
    </div>
  );
}
