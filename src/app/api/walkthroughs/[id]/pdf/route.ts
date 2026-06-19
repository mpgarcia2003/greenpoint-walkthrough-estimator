import { NextResponse } from "next/server";

import {
  createWalkthroughSupabaseClient,
  WALKTHROUGH_FILES_BUCKET,
} from "@/app/api/walkthroughs/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await createWalkthroughSupabaseClient(request);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;
  const { data: row, error: rowError } = await auth.supabase
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

  const { data: file, error: fileError } = await auth.supabase.storage
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
