import { createClient } from "@supabase/supabase-js";

// Browser client (uses anon key, respects RLS)
export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.SUPABASE_ANON_KEY!;
  return createClient(url, anonKey);
}

// Server-side admin client (bypasses RLS)
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin operations");
  }
  return createClient(url, serviceRoleKey);
}
