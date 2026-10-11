import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

// Leave authentication disabled until real project credentials are provided.
export const supabase = url && key && !url.includes('YOUR_PROJECT') && !key.includes('YOUR_')
  ? createClient(url, key)
  : null;

// Render the library's real form before setup without storing credentials or
// allowing any requests to a placeholder project.
export const authUiClient = supabase ?? createClient(
  'https://preview.invalid',
  'preview-publishable-key',
  {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async () => { throw new Error('Account registration is not configured yet.'); } },
  },
);
