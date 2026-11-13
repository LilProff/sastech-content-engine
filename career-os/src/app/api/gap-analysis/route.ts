import { requireAuth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { scrapeUrl } from '@/lib/scrape';
import { callOpenRouter } from '@/lib/openrouter';
import type { Profile } from '@/lib/types';

export const maxDuration = 45;

const SYSTEM_PROMPT = `You compare a job, internship, or scholarship posting against a candidate's profile and produce a gap analysis.
Return ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:
{"matched_skills": string[], "missing_skills": string[], "notes": string}
matched_skills: skills or experience from the profile that clearly match what the posting asks for.
missing_skills: requirements the posting mentions that the profile shows no evidence of.
notes: two or three sentences of honest, specific assessment. Do not pad it with generic encouragement.`;

function summarizeProfile(profile: Profile): string {
  const lines: string[] = [];
  if (profile.headline) lines.push(`Headline: ${profile.headline}`);
  if (profile.summary) lines.push(`Summary: ${profile.summary}`);
  if (profile.skills?.length) {
    lines.push(`Skills: ${profile.skills.map((s) => s.name).filter(Boolean).join(', ')}`);
  }
  if (profile.work_history?.length) {
    lines.push('Work history:');
    for (const job of profile.work_history) {
      const dates = `${job.start_date}–${job.current ? 'Present' : job.end_date}`;
      lines.push(`- ${job.title} at ${job.company} (${dates}): ${job.description}`);
      for (const a of job.achievements ?? []) lines.push(`  - ${a}`);
    }
  }
  if (profile.education?.length) {
    lines.push('Education:');
    for (const edu of profile.education) lines.push(`- ${edu.degree} ${edu.field} at ${edu.school}`);
  }
  if (profile.certifications?.length) {
    lines.push(`Certifications: ${profile.certifications.map((c) => c.name).filter(Boolean).join(', ')}`);
  }
  return lines.join('\n') || 'No profile details recorded yet.';
}

export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const opportunityId = typeof body?.opportunityId === 'string' ? body.opportunityId : '';
  if (!opportunityId) {
    return Response.json({ error: 'opportunityId is required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: opportunity, error: oppError } = await admin
    .from('opportunities')
    .select('*')
    .eq('id', opportunityId)
    .eq('user_id', auth.userId)
    .single();

  if (oppError || !opportunity) {
    return Response.json({ error: 'Opportunity not found' }, { status: 404 });
  }

  let content: string = opportunity.fetched_content || '';

  if (!content && opportunity.source_url) {
    try {
      content = await scrapeUrl(opportunity.source_url);
      await admin.from('opportunities').update({ fetched_content: content }).eq('id', opportunityId);
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : 'Could not fetch the posting.' },
        { status: 502 }
      );
    }
  }

  if (!content) {
    return Response.json(
      { error: 'No posting content to analyze. Add a source URL first.' },
      { status: 400 }
    );
  }

  const { data: profile } = await admin
    .from('profile')
    .select('*')
    .eq('user_id', auth.userId)
    .maybeSingle();

  if (!profile) {
    return Response.json({ error: 'Fill in your profile first.' }, { status: 400 });
  }

  try {
    const { message } = await callOpenRouter({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `POSTING:\n${content.slice(0, 6000)}\n\nCANDIDATE PROFILE:\n${summarizeProfile(profile as Profile)}`,
        },
      ],
    });

    const raw = (message.content ?? '').replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    let parsed: { matched_skills?: unknown; missing_skills?: unknown; notes?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json(
        { error: 'The assistant returned an unexpected format. Try again.' },
        { status: 502 }
      );
    }

    const gapAnalysis = {
      matched_skills: Array.isArray(parsed.matched_skills) ? parsed.matched_skills : [],
      missing_skills: Array.isArray(parsed.missing_skills) ? parsed.missing_skills : [],
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    };

    await admin.from('opportunities').update({ gap_analysis: gapAnalysis }).eq('id', opportunityId);

    return Response.json({ gapAnalysis });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Gap analysis failed.' },
      { status: 502 }
    );
  }
}
