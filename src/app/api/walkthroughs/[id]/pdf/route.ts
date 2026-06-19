import { NextResponse } from "next/server";

import { cloudUnavailableResponse, isWalkthroughApiAuthorized } from "@/app/api/walkthroughs/auth";
import { createSupabaseAdminClient, hasSupabaseAdminConfig, WALKTHROUGH_FILES_BUCKET } from "@/lib/supabase-admin";

export async function GET(
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
  const { data: row, error: rowError } = await supabase
    .from("walkthroughs")
    .select("title,pdf_path")
    .eq("id", id)
    .single();

  if (rowError || !row?.pdf_path) {
    return NextResponse.json(
      { ok: false, message: "No saved PDF found for this walkthrough." },
      { status: 404 },
    );
  }

  const { data: file, error: fileError } = await supabase.storage
    .from(WALKTHROUGH_FILES_BUCKET)
    .download(row.pdf_path);

  if (fileError || !file) {
    return NextResponse.json(
      { ok: false, message: fileError?.message ?? "Could not load PDF." },
      { status: 500 },
    );
  }

  const fileName = `${String(row.title ?? "walkthrough")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase()}.pdf`;

  return new Response(file, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
