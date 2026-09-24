import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  string | undefined;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Configuration Supabase manquante : VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (voir .env).",
  );
}

const isBrowser = typeof window !== "undefined";

// Client unique pour toute l'app (singleton de module).
// La session vit dans le localStorage du navigateur : les routes qui en dépendent
// sont rendues côté client (`ssr: false`), le serveur ne voit jamais la session.
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: isBrowser ? window.localStorage : undefined,
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
  },
});
