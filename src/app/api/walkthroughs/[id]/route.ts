import { NextResponse } from "next/server";

import { cloudUnavailableResponse, isWalkthroughApiAuthorized } from "@/app/api/walkthroughs/auth";
import { createSupabaseAdminClient, hasSupabaseAdminConfig, WALKTHROUGH_FILES_BUCKET } from "@/lib/supabase-admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isWalkthroughApiAuthorized())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!hasSupabaseAdminConfig()) {
    return cloudUnavailableResponse();
  }

  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("walkthroughs")
    .select("pdf_path")
    .eq("id", id)
    .single();

  if (data?.pdf_path) {
    await supabase.storage
      .from(WALKTHROUGH_FILES_BUCKET)
      .remove([data.pdf_path]);
  }

  const { error } = await supabase.from("walkthroughs").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
