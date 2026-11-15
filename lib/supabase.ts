import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabasePublicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let client: ReturnType<typeof createGuestbookClient> | undefined;

export function createGuestbookClient(persistSession: boolean) {
  if (!supabaseUrl || !supabasePublicKey) throw new Error("Supabase environment variables are missing");
  return createClient(supabaseUrl, supabasePublicKey, {
    auth: {
      persistSession,
      autoRefreshToken: persistSession,
      detectSessionInUrl: false,
      ...(persistSession ? {} : { storageKey: "moa-email-verification" }),
    },
  });
}

export function supabase() {
  return client ??= createGuestbookClient(true);
}
