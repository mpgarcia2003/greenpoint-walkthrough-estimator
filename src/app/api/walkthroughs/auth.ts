import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import type { EstimateDraft } from "@/lib/types";

export const WALKTHROUGH_FILES_BUCKET = "walkthrough-files";

type WalkthroughRow = {
  id: string;
  organization_id: string;
  created_by: string | null;
  title: string;
  client_name: string | null;
  facility_name: string | null;
  facility_type: string | null;
  total_rooms: number;
  total_minutes: number;
  total_hours: number;
  monthly_price: number;
  annual_price: number;
  monthly_profit: number;
  annual_profit: number;
  estimate: EstimateDraft;
  pdf_path: string | null;
  proposal_pdf_path: string | null;
  proposal_generated_at: string | null;
  created_at: string;
  updated_at: string;
};

type WalkthroughInsert = Omit<WalkthroughRow, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

type WalkthroughUpdate = Partial<WalkthroughInsert>;

type WalkthroughDatabase = {
  public: {
    Tables: {
      walkthroughs: {
        Row: WalkthroughRow;
        Insert: WalkthroughInsert;
        Update: WalkthroughUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

function getSupabaseRouteConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return undefined;
  }

  return { key, url };
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("Authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  return match?.[1];
}

export function cloudUnavailableResponse() {
  return NextResponse.json(
    {
      ok: false,
      message:
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    },
    { status: 503 },
  );
}

export async function createWalkthroughSupabaseClient(request: Request): Promise<
  | {
      response: NextResponse;
      supabase?: never;
      user?: never;
    }
  | {
      response?: never;
      supabase: SupabaseClient<WalkthroughDatabase>;
      user: User;
    }
> {
  const config = getSupabaseRouteConfig();

  if (!config) {
    return { response: cloudUnavailableResponse() };
  }

  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return {
      response: NextResponse.json(
        { ok: false, message: "Sign in required." },
        { status: 401 },
      ),
    };
  }

  const supabase = createClient<WalkthroughDatabase>(config.url, config.key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return {
      response: NextResponse.json(
        { ok: false, message: "Session expired. Sign in again." },
        { status: 401 },
      ),
    };
  }

  return { supabase, user: data.user };
}
