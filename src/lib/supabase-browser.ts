"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

export function getSupabaseBrowserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return undefined;
  }

  return { key, url };
}

export function hasSupabaseBrowserConfig() {
  return Boolean(getSupabaseBrowserConfig());
}

export function createBrowserSupabaseClient() {
  const config = getSupabaseBrowserConfig();

  if (!config) {
    throw new Error(
      "Supabase requires NEXT_PUBLIC_SUPABASE_URL and a publishable or anon key.",
    );
  }

  browserClient ??= createClient(config.url, config.key, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });

  return browserClient;
}
