import { NextResponse } from "next/server";

import {
  createWalkthroughSupabaseClient,
  WALKTHROUGH_FILES_BUCKET,
} from "@/app/api/walkthroughs/auth";

function safeFileName(fileName: string) {
  return (
    fileName
      .replace(/[^a-z0-9.-]+/gi, "-")
      .replace(/(^-|-$)/g, "")
      .toLowerCase() || "proposal.pdf"
  );
}

function proposalFileName(title: string | null) {
  const baseName =
    String(title ?? "walkthrough")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/(^-|-$)/g, "")
      .toLowerCase() || "walkthrough";

  return `${baseName}-proposal.pdf`;
}

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
    .select("title,proposal_pdf_path")
    .eq("id", id)
    .single();

  if (rowError || !row?.proposal_pdf_path) {
    return NextResponse.json(
      { ok: false, message: "No saved proposal PDF found for this walkthrough." },
      { status: 404 },
    );
  }

  const { data: file, error: fileError } = await auth.supabase.storage
    .from(WALKTHROUGH_FILES_BUCKET)
    .download(row.proposal_pdf_path);

  if (fileError || !file) {
    return NextResponse.json(
      { ok: false, message: fileError?.message ?? "Could not load proposal." },
      { status: 500 },
    );
  }

  return new Response(file, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${proposalFileName(row.title)}"`,
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await createWalkthroughSupabaseClient(request);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;
  const formData = await request.formData();
  const proposalFile = formData.get("proposal");

  if (
    !proposalFile ||
    typeof proposalFile !== "object" ||
    !("arrayBuffer" in proposalFile)
  ) {
    return NextResponse.json(
      { ok: false, message: "Missing proposal PDF." },
      { status: 400 },
    );
  }

  const { data: row, error: rowError } = await auth.supabase
    .from("walkthroughs")
    .select("organization_id,proposal_pdf_path")
    .eq("id", id)
    .single();

  if (rowError || !row?.organization_id) {
    return NextResponse.json(
      { ok: false, message: "Saved walkthrough not found." },
      { status: 404 },
    );
  }

  if (row.proposal_pdf_path) {
    await auth.supabase.storage
      .from(WALKTHROUGH_FILES_BUCKET)
      .remove([row.proposal_pdf_path]);
  }

  const file = proposalFile as File;
  const bytes = Buffer.from(await file.arrayBuffer());
  const proposalPath = `${row.organization_id}/walkthroughs/${id}/proposal/${safeFileName(file.name)}`;

  const { error: uploadError } = await auth.supabase.storage
    .from(WALKTHROUGH_FILES_BUCKET)
    .upload(proposalPath, bytes, {
      contentType: file.type || "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { ok: false, message: uploadError.message },
      { status: 500 },
    );
  }

  const generatedAt = new Date().toISOString();
  const { error: updateError } = await auth.supabase
    .from("walkthroughs")
    .update({
      proposal_generated_at: generatedAt,
      proposal_pdf_path: proposalPath,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { ok: false, message: updateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    proposalGeneratedAt: generatedAt,
    proposalPdfPath: proposalPath,
  });
}
