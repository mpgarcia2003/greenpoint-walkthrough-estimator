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

export async function clearActiveEstimate() {
  if (!database) {
    return;
  }

  await database.estimates.delete(ACTIVE_ESTIMATE_ID);
}
