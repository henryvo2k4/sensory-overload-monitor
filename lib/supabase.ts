import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nfczwxhmyijdbvceeygi.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_f_a5LR75HDlrZ10ulnX4Mg_FPIdwXwT';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
