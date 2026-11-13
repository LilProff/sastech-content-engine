import 'server-only';
import { getSupabaseAdmin } from './supabaseAdmin';
import { generateAndStoreCv } from './cvBuilder';
import type { ToolDefinition } from './openrouter';
import type { Profile } from './types';

export const ASSISTANT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_profile',
      description: "Fetch the user's full structured profile.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_profile',
      description:
        'Apply a partial update to the profile. Array fields (education_add, work_history_add, skills_add, certifications_add, languages_add) are additive — items are appended, never replacing existing entries.',
      parameters: {
        type: 'object',
        properties: {
          full_name: { type: 'string' },
          headline: { type: 'string' },
          summary: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          location: { type: 'string' },
          website: { type: 'string' },
          linkedin_url: { type: 'string' },
          github_url: { type: 'string' },
          education_add: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                school: { type: 'string' },
                degree: { type: 'string' },
                field: { type: 'string' },
                start_date: { type: 'string' },
                end_date: { type: 'string' },
                gpa: { type: 'string' },
                notes: { type: 'string' },
              },
            },
          },
          work_history_add: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                company: { type: 'string' },
                title: { type: 'string' },
                start_date: { type: 'string' },
                end_date: { type: 'string' },
                current: { type: 'boolean' },
                description: { type: 'string' },
                achievements: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          skills_add: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                category: { type: 'string' },
                level: { type: 'string' },
              },
            },
          },
          certifications_add: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                issuer: { type: 'string' },
                date: { type: 'string' },
                credential_url: { type: 'string' },
              },
            },
          },
          languages_add: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_documents',
      description: "Full-text search over the user's uploaded documents (CV, transcripts, certificates).",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'integer' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_opportunities',
      description: 'List the opportunities (jobs, internships, scholarships) the user is tracking.',
      parameters: {
        type: 'object',
        properties: { status: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_opportunity',
      description: 'Add a new opportunity to track.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          org_name: { type: 'string' },
          opportunity_type: {
            type: 'string',
            enum: ['job', 'internship', 'scholarship', 'grant', 'other'],
          },
          source_url: { type: 'string' },
          deadline: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_opportunity',
      description: "Update an opportunity's status or notes.",
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: {
            type: 'string',
            enum: ['saved', 'researching', 'drafting', 'applied', 'interview', 'offer', 'rejected', 'withdrawn'],
          },
          notes: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_cv',
      description: "Generate a PDF or Word CV from the user's current profile, optionally tailored to a tracked opportunity.",
      parameters: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['pdf', 'docx'] },
          opportunity_id: { type: 'string' },
        },
        required: ['format'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_memory',
      description:
        'Record a free-form note or update from the user that does not fit a structured profile field.',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
  },
];

const SCALAR_PROFILE_FIELDS = [
  'full_name',
  'headline',
  'summary',
  'email',
  'phone',
  'location',
  'website',
  'linkedin_url',
  'github_url',
] as const;

const LIST_FIELD_MAP: Record<string, keyof Profile> = {
  education_add: 'education',
  work_history_add: 'work_history',
  skills_add: 'skills',
  certifications_add: 'certifications',
  languages_add: 'languages',
};

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  const admin = getSupabaseAdmin();

  switch (name) {
    case 'get_profile': {
      const { data } = await admin.from('profile').select('*').eq('user_id', userId).maybeSingle();
      return data ?? { message: 'No profile saved yet.' };
    }

    case 'update_profile': {
      const { data: current } = await admin
        .from('profile')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      const base = (current ?? {}) as Partial<Profile>;

      const patch: Record<string, unknown> = {};
      for (const key of SCALAR_PROFILE_FIELDS) {
        if (typeof args[key] === 'string') patch[key] = args[key];
      }
      for (const [argKey, field] of Object.entries(LIST_FIELD_MAP)) {
        const incoming = args[argKey];
        if (Array.isArray(incoming) && incoming.length) {
          const existing = Array.isArray(base[field]) ? (base[field] as unknown[]) : [];
          patch[field] = [...existing, ...incoming];
        }
      }

      if (Object.keys(patch).length === 0) {
        return { success: false, message: 'Nothing to update.' };
      }

      const { error } = await admin.from('profile').upsert(patch, { onConflict: 'user_id' });
      if (error) return { error: error.message };
      return { success: true, updated: Object.keys(patch) };
    }

    case 'search_documents': {
      const query = typeof args.query === 'string' ? args.query : '';
      if (!query) return { error: 'query is required' };
      const limit = typeof args.limit === 'number' ? args.limit : 5;
      const { data, error } = await admin
        .from('document_chunks')
        .select('content, documents(file_name, doc_type)')
        .eq('user_id', userId)
        .textSearch('content_tsv', query, { type: 'plain' })
        .limit(limit);
      if (error) return { error: error.message };
      return data;
    }

    case 'list_opportunities': {
      let query = admin.from('opportunities').select('*').eq('user_id', userId);
      if (typeof args.status === 'string') query = query.eq('status', args.status);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) return { error: error.message };
      return data;
    }

    case 'create_opportunity': {
      if (typeof args.title !== 'string' || !args.title) return { error: 'title is required' };
      const { data, error } = await admin
        .from('opportunities')
        .insert({ user_id: userId, ...args })
        .select()
        .single();
      if (error) return { error: error.message };
      return data;
    }

    case 'update_opportunity': {
      const { id, ...rest } = args;
      if (typeof id !== 'string' || !id) return { error: 'id is required' };
      const { data, error } = await admin
        .from('opportunities')
        .update(rest)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) return { error: error.message };
      return data;
    }

    case 'generate_cv': {
      const format = args.format === 'docx' ? 'docx' : args.format === 'pdf' ? 'pdf' : null;
      if (!format) return { error: "format must be 'pdf' or 'docx'" };
      try {
        const result = await generateAndStoreCv(
          userId,
          format,
          typeof args.opportunity_id === 'string' ? args.opportunity_id : null
        );
        return { success: true, format: result.format, url: result.url };
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Could not generate the CV.' };
      }
    }

    case 'log_memory': {
      const text = typeof args.text === 'string' ? args.text : '';
      if (!text) return { error: 'text is required' };
      const { error } = await admin.from('chat_messages').insert({
        user_id: userId,
        role: 'system',
        content: `[memory] ${text}`,
        tool_name: 'log_memory',
      });
      if (error) return { error: error.message };
      return { success: true };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
