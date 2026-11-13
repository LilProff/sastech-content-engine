import 'server-only';
import { getSupabaseAdmin } from './supabaseAdmin';
import { buildCvDocx, buildCvPdf } from './cvTemplate';
import type { Profile } from './types';

// Orchestration — build, upload to the private cv-exports bucket, sign,
// and record a cv_versions row. Shared by api/cv-export/route.ts (the
// "Generate CV" button) and the assistant's generate_cv tool, so the
// logic lives in exactly one place. The actual document layout lives in
// cvTemplate.ts, which has no Supabase dependency and is safe to unit-test.

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // see api/cv-export/route.ts for why 7 days

export async function generateAndStoreCv(
  userId: string,
  format: 'pdf' | 'docx',
  opportunityId?: string | null
) {
  const admin = getSupabaseAdmin();

  const { data: profile, error: profileError } = await admin
    .from('profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error('No profile found. Fill in your profile first.');
  }

  const fileBytes = format === 'pdf' ? await buildCvPdf(profile as Profile) : await buildCvDocx(profile as Profile);
  const ext = format;
  const contentType =
    format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const path = `${userId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await admin.storage.from('cv-exports').upload(path, fileBytes, {
    contentType,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: signed, error: signError } = await admin.storage
    .from('cv-exports')
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signError || !signed) throw new Error(signError?.message || 'Could not create a download link.');

  const urlField = format === 'pdf' ? 'pdf_url' : 'docx_url';
  const { data: cvVersion, error: insertError } = await admin
    .from('cv_versions')
    .insert({
      user_id: userId,
      opportunity_id: opportunityId ?? null,
      profile_snapshot: profile,
      [urlField]: signed.signedUrl,
    })
    .select()
    .single();
  if (insertError) throw new Error(insertError.message);

  return { cvVersion, url: signed.signedUrl, format };
}
