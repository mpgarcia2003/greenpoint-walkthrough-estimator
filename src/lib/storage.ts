"use client";

import Dexie, { type Table } from "dexie";

import { ACTIVE_ESTIMATE_ID } from "@/lib/constants";
import type { EstimateDraft } from "@/lib/types";

type LocalEstimateRecord = EstimateDraft & {
  storageScopeId?: string;
};

class GreenPointDatabase extends Dexie {
  estimates!: Table<LocalEstimateRecord, string>;

  constructor() {
    super("GreenPointWalkthroughEstimator");
    this.version(1).stores({
      estimates: "id, updatedAt",
    });
    this.version(2).stores({
      estimates: "id, updatedAt, savedAt",
    });
    this.version(3).stores({
      estimates: "id, updatedAt, savedAt, storageScopeId",
    });
  }
}

const database =
  typeof window !== "undefined" ? new GreenPointDatabase() : undefined;

function getScopedActiveEstimateId(scopeId: string) {
  return `${ACTIVE_ESTIMATE_ID}:${scopeId}`;
}

function createSnapshotId(scopeId: string) {
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${scopeId}:${uniqueId}`;
}

function toEstimateDraft(record: LocalEstimateRecord): EstimateDraft {
  const estimate = { ...record };
  delete estimate.storageScopeId;

  return estimate;
}

export async function loadActiveEstimate(scopeId: string) {
  if (!database) {
    return undefined;
  }

  const record = await database.estimates.get(getScopedActiveEstimateId(scopeId));

  return record ? toEstimateDraft(record) : undefined;
}

export async function saveActiveEstimate(
  estimate: EstimateDraft,
  scopeId: string,
) {
  if (!database) {
    return;
  }

  await database.estimates.put({
    ...estimate,
    id: getScopedActiveEstimateId(scopeId),
    storageScopeId: scopeId,
  });
}

export async function listSavedEstimates(scopeId: string) {
  if (!database) {
    return [];
  }

  const estimates = await database.estimates
    .where("storageScopeId")
    .equals(scopeId)
    .filter((estimate) => Boolean(estimate.savedAt))
    .toArray();

  return estimates.sort((a, b) =>
    String(b.savedAt ?? "").localeCompare(String(a.savedAt ?? "")),
  ).map(toEstimateDraft);
}

export async function saveEstimateSnapshot(
  estimate: EstimateDraft,
  scopeId: string,
) {
  if (!database) {
    return estimate;
  }

  const now = new Date().toISOString();
  const savedEstimate: EstimateDraft = {
    ...estimate,
    id: createSnapshotId(scopeId),
    savedAt: now,
    updatedAt: now,
  };

  await database.estimates.put({
    ...savedEstimate,
    storageScopeId: scopeId,
  });

  return savedEstimate;
}

export async function deleteSavedEstimate(id: string, scopeId: string) {
  if (!database || id === getScopedActiveEstimateId(scopeId)) {
    return;
  }

  const estimate = await database.estimates.get(id);

  if (estimate?.storageScopeId !== scopeId) {
    return;
  }

  await database.estimates.delete(id);
}

export async function clearActiveEstimate(scopeId: string) {
  if (!database) {
    return;
  }

  await database.estimates.delete(getScopedActiveEstimateId(scopeId));
}
