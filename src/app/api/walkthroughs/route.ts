import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { cloudUnavailableResponse, isWalkthroughApiAuthorized } from "@/app/api/walkthroughs/auth";
import { createSupabaseAdminClient, hasSupabaseAdminConfig, WALKTHROUGH_FILES_BUCKET } from "@/lib/supabase-admin";
import type { EstimateDraft } from "@/lib/types";
import {
  cloudRowToEstimate,
  estimateToCloudRow,
  type CloudWalkthroughRow,
} from "@/lib/walkthrough-records";

function safeFileName(fileName: string) {
  return (
    fileName
      .replace(/[^a-z0-9.-]+/gi, "-")
      .replace(/(^-|-$)/g, "")
      .toLowerCase() || "walkthrough.pdf"
  );
}

export async function GET() {
  if (!(await isWalkthroughApiAuthorized())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!hasSupabaseAdminConfig()) {
    return cloudUnavailableResponse();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("walkthroughs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    walkthroughs: (data as CloudWalkthroughRow[]).map(cloudRowToEstimate),
  });
}

export async function POST(request: Request) {
  if (!(await isWalkthroughApiAuthorized())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!hasSupabaseAdminConfig()) {
    return cloudUnavailableResponse();
  }

  const formData = await request.formData();
  const estimateValue = formData.get("estimate");

  if (typeof estimateValue !== "string") {
    return NextResponse.json(
      { ok: false, message: "Missing estimate payload." },
      { status: 400 },
    );
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const estimate = JSON.parse(estimateValue) as EstimateDraft;
  const savedEstimate: EstimateDraft = {
    ...estimate,
    id,
    savedAt: now,
    updatedAt: now,
  };
  const supabase = createSupabaseAdminClient();
  const pdfFile = formData.get("pdf");
  let pdfPath: string | null = null;

  if (pdfFile && typeof pdfFile === "object" && "arrayBuffer" in pdfFile) {
    const file = pdfFile as File;
    const bytes = Buffer.from(await file.arrayBuffer());
    pdfPath = `walkthroughs/${id}/${safeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from(WALKTHROUGH_FILES_BUCKET)
      .upload(pdfPath, bytes, {
        contentType: file.type || "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { ok: false, message: uploadError.message },
        { status: 500 },
      );
    }
  }

  const { data, error } = await supabase
    .from("walkthroughs")
    .insert(estimateToCloudRow({ estimate: savedEstimate, id, pdfPath }))
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    walkthrough: cloudRowToEstimate(data as CloudWalkthroughRow),
  });
}
