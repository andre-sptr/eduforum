import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { env } from "@/lib/env";

const authStorage = typeof window !== "undefined" ? window.localStorage : null;

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: Boolean(authStorage),
    autoRefreshToken: Boolean(authStorage),
    detectSessionInUrl: true,
    ...(authStorage ? { storage: authStorage } : {}),
  },
  global: {
    headers: {
      "X-Client-Info": "eduforum-web",
    },
  },
});
