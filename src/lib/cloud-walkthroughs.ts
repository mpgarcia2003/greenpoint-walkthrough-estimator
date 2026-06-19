"use client";

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

export async function listCloudWalkthroughs() {
  const response = await fetch("/api/walkthroughs", {
    method: "GET",
  });
  await assertOk(response);

  const result = (await response.json()) as {
    walkthroughs: EstimateDraft[];
  };

  return result.walkthroughs;
}

export async function saveCloudWalkthrough({
  estimate,
  pdfBlob,
  pdfFileName,
}: {
  estimate: EstimateDraft;
  pdfBlob: Blob;
  pdfFileName: string;
}) {
  const formData = new FormData();
  formData.append("estimate", JSON.stringify(estimate));
  formData.append("pdf", pdfBlob, pdfFileName);

  const response = await fetch("/api/walkthroughs", {
    method: "POST",
    body: formData,
  });
  await assertOk(response);

  const result = (await response.json()) as {
    walkthrough: EstimateDraft;
  };

  return result.walkthrough;
}

export async function deleteCloudWalkthrough(id: string) {
  const response = await fetch(`/api/walkthroughs/${id}`, {
    method: "DELETE",
  });
  await assertOk(response);
}

export async function downloadCloudWalkthroughPdf(id: string) {
  const response = await fetch(`/api/walkthroughs/${id}/pdf`);
  await assertOk(response);

  const blob = await response.blob();
  downloadBlob(blob, getFileNameFromDisposition(response.headers.get("Content-Disposition")));
}
