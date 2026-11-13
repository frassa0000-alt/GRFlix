import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Validate that Supabase URL is a real HTTP/HTTPS URL and not a placeholder
const isValidHttpUrl = (value: string): boolean => {
  if (!value || value.includes('your-project')) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

// Keys are read from client environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  isValidHttpUrl(supabaseUrl) &&
    supabaseAnonKey &&
    !supabaseAnonKey.includes('your-anon-key')
);

let client: SupabaseClient | null = null;
if (isSupabaseConfigured) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  } catch {
    client = null;
  }
}

export const supabase: SupabaseClient | null = client;
