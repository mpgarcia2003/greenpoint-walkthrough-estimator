import {
  getCostSummary,
  getStaffingTotals,
  getTotals,
  normalizeCleaningFrequency,
} from "@/lib/calculations";
import type { EstimateDraft } from "@/lib/types";

export interface CloudWalkthroughRow {
  id: string;
  organization_id: string;
  created_by: string | null;
  title: string;
  client_name: string | null;
  facility_name: string | null;
  facility_type: string | null;
  total_rooms: number;
  total_minutes: number;
  total_hours: number;
  monthly_price: number;
  annual_price: number;
  monthly_profit: number;
  annual_profit: number;
  estimate: EstimateDraft;
  pdf_path: string | null;
  created_at: string;
  updated_at: string;
}

export function estimateToCloudRow({
  estimate,
  id,
  organizationId,
  createdBy,
  pdfPath,
}: {
  estimate: EstimateDraft;
  id: string;
  organizationId: string;
  createdBy: string;
  pdfPath?: string | null;
}) {
  const cleaningFrequency = normalizeCleaningFrequency(estimate.cleaningFrequency);
  const totals = getTotals(estimate.entries);
  const staffing = getStaffingTotals(estimate.entries, cleaningFrequency);
  const cost = getCostSummary(staffing, estimate.pricing);
  const title =
    estimate.facility.facilityName.trim() ||
    estimate.facility.clientName.trim() ||
    "Untitled Walkthrough";

  return {
    id,
    organization_id: organizationId,
    created_by: createdBy,
    title,
    client_name: estimate.facility.clientName || null,
    facility_name: estimate.facility.facilityName || null,
    facility_type: estimate.facility.facilityType || null,
    total_rooms: totals.totalRooms,
    total_minutes: totals.totalMinutes,
    total_hours: totals.totalHours,
    monthly_price: cost.recommendedMonthlyContract,
    annual_price: cost.recommendedAnnualContract,
    monthly_profit: cost.grossMonthlyProfit,
    annual_profit: cost.grossAnnualProfit,
    estimate,
    pdf_path: pdfPath ?? null,
  };
}

export function cloudRowToEstimate(row: CloudWalkthroughRow): EstimateDraft {
  return {
    ...row.estimate,
    id: row.id,
    savedAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
