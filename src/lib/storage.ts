"use client";

import Dexie, { type Table } from "dexie";

import { ACTIVE_ESTIMATE_ID } from "@/lib/constants";
import type { EstimateDraft } from "@/lib/types";

class GreenPointDatabase extends Dexie {
  estimates!: Table<EstimateDraft, string>;

  constructor() {
    super("GreenPointWalkthroughEstimator");
    this.version(1).stores({
      estimates: "id, updatedAt",
    });
    this.version(2).stores({
      estimates: "id, updatedAt, savedAt",
    });
  }
}

const database =
  typeof window !== "undefined" ? new GreenPointDatabase() : undefined;

export async function loadActiveEstimate() {
  if (!database) {
    return undefined;
  }

  return database.estimates.get(ACTIVE_ESTIMATE_ID);
}

export async function saveActiveEstimate(estimate: EstimateDraft) {
  if (!database) {
    return;
  }

  await database.estimates.put(estimate);
}

export async function listSavedEstimates() {
  if (!database) {
    return [];
  }

  const estimates = await database.estimates.where("savedAt").above("").toArray();

  return estimates.sort((a, b) =>
    String(b.savedAt ?? "").localeCompare(String(a.savedAt ?? "")),
  );
}

export async function saveEstimateSnapshot(estimate: EstimateDraft) {
  if (!database) {
    return estimate;
  }

  const now = new Date().toISOString();
  const savedEstimate: EstimateDraft = {
    ...estimate,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    savedAt: now,
    updatedAt: now,
  };

  await database.estimates.put(savedEstimate);

  return savedEstimate;
}

export async function deleteSavedEstimate(id: string) {
  if (!database || id === ACTIVE_ESTIMATE_ID) {
    return;
  }

  await database.estimates.delete(id);
}

export async function clearActiveEstimate() {
  if (!database) {
    return;
  }

  await database.estimates.delete(ACTIVE_ESTIMATE_ID);
}
