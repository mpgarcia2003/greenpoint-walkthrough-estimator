import { NextResponse } from "next/server";

import {
  createWalkthroughSupabaseClient,
  WALKTHROUGH_FILES_BUCKET,
} from "@/app/api/walkthroughs/auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await createWalkthroughSupabaseClient(request);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;
  const { data, error: rowError } = await auth.supabase
    .from("walkthroughs")
    .select("pdf_path")
    .eq("id", id)
    .single();

  if (rowError) {
    return NextResponse.json(
      { ok: false, message: "Saved walkthrough not found." },
      { status: 404 },
    );
  }

  if (data?.pdf_path) {
    await auth.supabase.storage
      .from(WALKTHROUGH_FILES_BUCKET)
      .remove([data.pdf_path]);
  }

  const { error } = await auth.supabase
    .from("walkthroughs")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
