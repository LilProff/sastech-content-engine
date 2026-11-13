'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getSupabaseClient, safeQuery } from '@/lib/supabaseClient';
import { emptyProfile, type Profile } from '@/lib/types';
import { TextField, TextAreaField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { SectionCard } from '@/components/ui/SectionCard';
import { EducationSection } from './EducationSection';
import { WorkHistorySection } from './WorkHistorySection';
import { SkillsSection } from './SkillsSection';
import { CertificationsSection } from './CertificationsSection';
import { LanguagesSection } from './LanguagesSection';

export function ProfileEditor() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = getSupabaseClient();
      const { data, error } = await safeQuery(sb.from('profile').select('*').maybeSingle());
      if (cancelled) return;
      if (error) {
        toast.error('Could not load your profile.', { description: error });
      } else if (data) {
        setProfile({ ...emptyProfile, ...data });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof Profile>(key: K, val: Profile[K]) {
    setProfile((p) => ({ ...p, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    const sb = getSupabaseClient();
    // id/user_id/updated_at are DB-assigned (user_id defaults to auth.uid() — see
    // supabase-schema-career-os.sql — so the upsert's conflict target resolves correctly
    // without the client needing to know its own user id).
    const { id: _id, user_id: _userId, updated_at: _updatedAt, ...rest } = profile;
    const { error } = await safeQuery(sb.from('profile').upsert(rest, { onConflict: 'user_id' }));
    setSaving(false);
    if (error) {
      toast.error('Save failed.', { description: error });
    } else {
      toast.success('Profile saved.');
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted">Loading your profile…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Profile</h1>
          <p className="mt-1 text-sm text-muted">
            The source of truth your CV and the Assistant draw from.
          </p>
        </div>
        <Button variant="primary" type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className="flex flex-col gap-5">
        <SectionCard title="Basics">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Full name"
              value={profile.full_name}
              onChange={(e) => set('full_name', e.target.value)}
            />
            <TextField
              label="Headline"
              value={profile.headline}
              placeholder="Software Engineer"
              onChange={(e) => set('headline', e.target.value)}
            />
            <TextField
              label="Email"
              type="email"
              value={profile.email}
              onChange={(e) => set('email', e.target.value)}
            />
            <TextField
              label="Phone"
              value={profile.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
            <TextField
              label="Location"
              value={profile.location}
              onChange={(e) => set('location', e.target.value)}
            />
            <TextField
              label="Website"
              value={profile.website}
              onChange={(e) => set('website', e.target.value)}
            />
            <TextField
              label="LinkedIn"
              value={profile.linkedin_url}
              onChange={(e) => set('linkedin_url', e.target.value)}
            />
            <TextField
              label="GitHub"
              value={profile.github_url}
              onChange={(e) => set('github_url', e.target.value)}
            />
          </div>
          <TextAreaField
            label="Summary"
            className="mt-3"
            rows={3}
            value={profile.summary}
            onChange={(e) => set('summary', e.target.value)}
          />
        </SectionCard>

        <EducationSection value={profile.education} onChange={(v) => set('education', v)} />
        <WorkHistorySection value={profile.work_history} onChange={(v) => set('work_history', v)} />
        <SkillsSection value={profile.skills} onChange={(v) => set('skills', v)} />
        <CertificationsSection
          value={profile.certifications}
          onChange={(v) => set('certifications', v)}
        />
        <LanguagesSection value={profile.languages} onChange={(v) => set('languages', v)} />
      </div>
    </div>
  );
}
