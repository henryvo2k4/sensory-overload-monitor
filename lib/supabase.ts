import { createClient } from '@supabase/supabase-js';

export const KNOWN_GOOD_SUPABASE_URL = 'https://nfczwxhmyijdbvceeygi.supabase.co';
export const KNOWN_GOOD_SUPABASE_KEY = 'sb_publishable_f_a5LR75HDlrZ10ulnX4Mg_FPIdwXwT';

const sanitize = (val?: string) => (val ? val.trim().replace(/^["']|["']$/g, '') : '');

let rawUrl = sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL);
let rawKey = sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

if (!rawUrl || !rawUrl.startsWith('http')) {
  rawUrl = KNOWN_GOOD_SUPABASE_URL;
}
rawUrl = rawUrl.replace(/\/+$/, '');

if (!rawKey || (!rawKey.startsWith('sb_') && !rawKey.startsWith('eyJ'))) {
  rawKey = KNOWN_GOOD_SUPABASE_KEY;
}

export const supabase = createClient(rawUrl, rawKey);

export function getSafeSupabaseClient() {
  return createClient(KNOWN_GOOD_SUPABASE_URL, KNOWN_GOOD_SUPABASE_KEY);
}
