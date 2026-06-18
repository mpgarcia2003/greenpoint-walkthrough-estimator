import { ACTIVE_ESTIMATE_ID, FREQUENCY_OPTIONS, ROOM_TYPES } from "@/lib/constants";
import type {
  CleaningFrequency,
  CostSummary,
  EstimateDraft,
  EstimateTotals,
  FacilityInfo,
  PricingInputs,
  RoomBreakdown,
  RoomEntry,
  RoomType,
  StaffingTotals,
} from "@/lib/types";

const LEGACY_FREQUENCIES: Partial<Record<string, CleaningFrequency>> = {
  Daily: "5 days/week",
  "3x Weekly": "3 days/week",
  Weekly: "1 day/week",
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatHours(minutes: number) {
  return round(minutes / 60, 2);
}

export function getTotals(entries: RoomEntry[]): EstimateTotals {
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);

  return {
    totalRooms: entries.length,
    totalMinutes,
    totalHours: formatHours(totalMinutes),
  };
}

export function normalizeCleaningFrequency(
  frequency?: string,
): CleaningFrequency {
  if (!frequency) {
    return "5 days/week";
  }

  if (LEGACY_FREQUENCIES[frequency]) {
    return LEGACY_FREQUENCIES[frequency];
  }

  const matchedFrequency = FREQUENCY_OPTIONS.find(
    (option) => option.value === frequency,
  );

  return matchedFrequency?.value ?? "5 days/week";
}

export function getVisitsPerWeek(frequency?: string) {
  const normalizedFrequency = normalizeCleaningFrequency(frequency);

  return (
    FREQUENCY_OPTIONS.find((option) => option.value === normalizedFrequency)
      ?.visitsPerWeek ?? 5
  );
}

export function getNextRoomNumber(entries: RoomEntry[], roomType: RoomType) {
  const largestNumber = entries
    .filter((entry) => entry.roomType === roomType)
    .reduce((max, entry) => Math.max(max, entry.roomNumber), 0);

  return largestNumber + 1;
}

export function createRoomEntry(
  entries: RoomEntry[],
  roomType: RoomType,
  minutes: number,
  cleaningFrequency?: CleaningFrequency,
): RoomEntry {
  const now = new Date().toISOString();

  return {
    id: createId(),
    roomType,
    roomNumber: getNextRoomNumber(entries, roomType),
    minutes,
    cleaningFrequency,
    createdAt: now,
    updatedAt: now,
  };
}

export function getRoomBreakdown(
  entries: RoomEntry[],
  defaultFrequency: CleaningFrequency = "5 days/week",
): RoomBreakdown[] {
  return ROOM_TYPES.map((roomType) => {
    const matchingEntries = entries.filter((entry) => entry.roomType === roomType);
    const minutes = matchingEntries.reduce((sum, entry) => sum + entry.minutes, 0);
    const weeklyMinutes = matchingEntries.reduce(
      (sum, entry) =>
        sum +
        entry.minutes *
          getVisitsPerWeek(entry.cleaningFrequency ?? defaultFrequency),
      0,
    );

    return {
      roomType,
      count: matchingEntries.length,
      minutes,
      hours: formatHours(minutes),
      weeklyHours: formatHours(weeklyMinutes),
    };
  }).filter((row) => row.count > 0);
}

export function getStaffingTotals(
  entries: RoomEntry[],
  cleaningFrequency: CleaningFrequency,
): StaffingTotals {
  const weeklyLaborMinutes = entries.reduce((sum, entry) => {
    const entryFrequency = entry.cleaningFrequency ?? cleaningFrequency;

    return sum + entry.minutes * getVisitsPerWeek(entryFrequency);
  }, 0);
  const weeklyLaborHours = weeklyLaborMinutes / 60;
  const monthlyLaborHours = (weeklyLaborHours * 52) / 12;
  const annualLaborHours = weeklyLaborHours * 52;
  const defaultVisitsPerWeek = getVisitsPerWeek(cleaningFrequency);
  const totalVisitHours = entries.reduce((sum, entry) => sum + entry.minutes, 0) / 60;

  return {
    visitsPerWeek: defaultVisitsPerWeek,
    perVisitLaborHours: round(totalVisitHours),
    dailyLaborHours: round(
      defaultVisitsPerWeek > 0 ? weeklyLaborHours / defaultVisitsPerWeek : 0,
    ),
    weeklyLaborHours: round(weeklyLaborHours),
    monthlyLaborHours: round(monthlyLaborHours),
    annualLaborHours: round(annualLaborHours),
  };
}

export function getCostSummary(
  staffing: StaffingTotals,
  pricing: PricingInputs,
): CostSummary {
  const monthlyDirectLaborCost = staffing.monthlyLaborHours * pricing.hourlyWage;
  const monthlyLoadedLaborCost =
    monthlyDirectLaborCost * (1 + pricing.payrollBurdenPercent / 100);
  const monthlyOverheadCost =
    monthlyLoadedLaborCost * (pricing.overheadPercent / 100);
  const monthlyCost = monthlyLoadedLaborCost + monthlyOverheadCost;
  const grossMonthlyProfit = monthlyCost * (pricing.profitPercent / 100);
  const recommendedMonthlyContract = monthlyCost + grossMonthlyProfit;

  return {
    monthlyDirectLaborCost: round(monthlyDirectLaborCost),
    monthlyLoadedLaborCost: round(monthlyLoadedLaborCost),
    monthlyOverheadCost: round(monthlyOverheadCost),
    monthlyCost: round(monthlyCost),
    annualCost: round(monthlyCost * 12),
    recommendedMonthlyContract: round(recommendedMonthlyContract),
    recommendedAnnualContract: round(recommendedMonthlyContract * 12),
    grossMonthlyProfit: round(grossMonthlyProfit),
  };
}

export function updateRoomEntry(
  entries: RoomEntry[],
  id: string,
  updates: Pick<RoomEntry, "roomType" | "minutes"> & {
    cleaningFrequency?: CleaningFrequency;
  },
) {
  const entryBeingUpdated = entries.find((entry) => entry.id === id);

  if (!entryBeingUpdated) {
    return entries;
  }

  const remainingEntries = entries.filter((entry) => entry.id !== id);
  const roomTypeChanged = entryBeingUpdated.roomType !== updates.roomType;
  const now = new Date().toISOString();

  return entries.map((entry) => {
    if (entry.id !== id) {
      return entry;
    }

    return {
      ...entry,
      roomType: updates.roomType,
      roomNumber: roomTypeChanged
        ? getNextRoomNumber(remainingEntries, updates.roomType)
        : entry.roomNumber,
      minutes: updates.minutes,
      cleaningFrequency: updates.cleaningFrequency,
      updatedAt: now,
    };
  });
}

export function buildEstimateDraft({
  facility,
  entries,
  selectedRoomType,
  cleaningFrequency,
  pricing,
}: Omit<EstimateDraft, "id" | "updatedAt">): EstimateDraft {
  return {
    id: ACTIVE_ESTIMATE_ID,
    facility,
    entries,
    selectedRoomType,
    cleaningFrequency,
    pricing,
    updatedAt: new Date().toISOString(),
  };
}

export function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function facilityLabel(facility: FacilityInfo) {
  return facility.facilityName.trim() || "GreenPoint Estimate";
}
