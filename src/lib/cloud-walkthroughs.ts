"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { EstimateDraft } from "@/lib/types";

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function getFileNameFromDisposition(disposition: string | null) {
  const match = disposition?.match(/filename="([^"]+)"/i);

  return match?.[1] ?? "walkthrough.pdf";
}

async function assertOk(response: Response) {
  if (response.ok) {
    return;
  }

  const result = (await response.json().catch(() => ({}))) as {
    message?: string;
  };

  throw new Error(result.message ?? "Cloud walkthrough request failed.");
}

async function getAuthHeaders() {
  const supabase = createBrowserSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("Sign in before using cloud walkthrough storage.");
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function listCloudWalkthroughs(organizationId: string) {
  const response = await fetch(
    `/api/walkthroughs?organizationId=${encodeURIComponent(organizationId)}`,
    {
      headers: await getAuthHeaders(),
      method: "GET",
    },
  );
  await assertOk(response);

  const result = (await response.json()) as {
    walkthroughs: EstimateDraft[];
  };

  return result.walkthroughs;
}

export async function saveCloudWalkthrough({
  organizationId,
  estimate,
  pdfBlob,
  pdfFileName,
}: {
  organizationId: string;
  estimate: EstimateDraft;
  pdfBlob: Blob;
  pdfFileName: string;
}) {
  const formData = new FormData();
  formData.append("organizationId", organizationId);
  formData.append("estimate", JSON.stringify(estimate));
  formData.append("pdf", pdfBlob, pdfFileName);

  const response = await fetch("/api/walkthroughs", {
    body: formData,
    headers: await getAuthHeaders(),
    method: "POST",
  });
  await assertOk(response);

  const result = (await response.json()) as {
    walkthrough: EstimateDraft;
  };

  return result.walkthrough;
}

export async function deleteCloudWalkthrough(id: string) {
  const response = await fetch(`/api/walkthroughs/${id}`, {
    headers: await getAuthHeaders(),
    method: "DELETE",
  });
  await assertOk(response);
}

export async function downloadCloudWalkthroughPdf(id: string) {
  const response = await fetch(`/api/walkthroughs/${id}/pdf`, {
    headers: await getAuthHeaders(),
    method: "GET",
  });
  await assertOk(response);

  const blob = await response.blob();
  downloadBlob(blob, getFileNameFromDisposition(response.headers.get("Content-Disposition")));
}
