import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  createWalkthroughSupabaseClient,
  WALKTHROUGH_FILES_BUCKET,
} from "@/app/api/walkthroughs/auth";
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

export async function GET(request: Request) {
  const auth = await createWalkthroughSupabaseClient(request);

  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");

  if (!organizationId) {
    return NextResponse.json(
      { ok: false, message: "Missing organizationId." },
      { status: 400 },
    );
  }

  const { supabase } = auth;
  const { data, error } = await supabase
    .from("walkthroughs")
    .select("*")
    .eq("organization_id", organizationId)
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
  const auth = await createWalkthroughSupabaseClient(request);

  if (auth.response) {
    return auth.response;
  }

  const formData = await request.formData();
  const estimateValue = formData.get("estimate");
  const organizationIdValue = formData.get("organizationId");

  if (typeof estimateValue !== "string") {
    return NextResponse.json(
      { ok: false, message: "Missing estimate payload." },
      { status: 400 },
    );
  }

  if (typeof organizationIdValue !== "string" || !organizationIdValue) {
    return NextResponse.json(
      { ok: false, message: "Missing organizationId." },
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
  const pdfFile = formData.get("pdf");
  let pdfPath: string | null = null;

  if (pdfFile && typeof pdfFile === "object" && "arrayBuffer" in pdfFile) {
    const file = pdfFile as File;
    const bytes = Buffer.from(await file.arrayBuffer());
    pdfPath = `${organizationIdValue}/walkthroughs/${id}/${safeFileName(file.name)}`;

    const { error: uploadError } = await auth.supabase.storage
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

  const { data, error } = await auth.supabase
    .from("walkthroughs")
    .insert(
      estimateToCloudRow({
        estimate: savedEstimate,
        id,
        organizationId: organizationIdValue,
        createdBy: auth.user.id,
        pdfPath,
      }),
    )
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
