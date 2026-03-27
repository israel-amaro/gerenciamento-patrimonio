import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const missingSupabaseEnv = !supabaseUrl || !supabaseAnonKey;
export const supabaseEnvErrorMessage = "As variaveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar definidas no arquivo .env.";

export const supabase = missingSupabaseEnv
  ? null
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "equipcontrol-auth"
      }
    });
