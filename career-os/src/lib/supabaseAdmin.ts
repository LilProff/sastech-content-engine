import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** Service-role client — server-only, never import from a Client Component. */
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
