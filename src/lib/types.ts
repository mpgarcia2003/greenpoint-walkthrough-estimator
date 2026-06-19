export type FacilityType =
  | "School"
  | "College"
  | "Office Building"
  | "Government Building"
  | "Airport"
  | "Warehouse"
  | "Manufacturing Facility"
  | "Hospital"
  | "Medical Office"
  | "Retail"
  | "Other";

export type RoomType =
  | "Classroom"
  | "Office"
  | "Bathroom"
  | "Lab"
  | "Conference Room"
  | "Theater"
  | "Performance Center"
  | "Gym"
  | "Locker Room"
  | "Dressing Room"
  | "Hallway"
  | "Stairwell"
  | "Cafeteria"
  | "Kitchen"
  | "Warehouse Area"
  | "Production Floor"
  | "Break Room"
  | "Reception Area"
  | "Medical Exam Room"
  | "Patient Room"
  | "Storage Room"
  | "Other";

export type CleaningFrequency =
  | "1 day/week"
  | "2 days/week"
  | "3 days/week"
  | "4 days/week"
  | "5 days/week"
  | "6 days/week"
  | "7 days/week"
  | "Bi-weekly"
  | "Monthly";

export interface FacilityInfo {
  facilityName: string;
  clientName: string;
  address: string;
  squareFootage: number;
  numberOfFloors: number;
  facilityType: FacilityType;
}

export interface RoomEntry {
  id: string;
  buildingId: string;
  roomType: RoomType;
  roomNumber: number;
  floorNumber: number;
  minutes: number;
  cleaningFrequency?: CleaningFrequency;
  createdAt: string;
  updatedAt: string;
}

export interface BuildingInfo {
  id: string;
  name: string;
  numberOfFloors: number;
}

export interface PricingInputs {
  hourlyWage: number;
  payrollBurdenPercent: number;
  overheadPercent: number;
  profitPercent: number;
}

export interface EstimateDraft {
  id: string;
  facility: FacilityInfo;
  buildings: BuildingInfo[];
  entries: RoomEntry[];
  walkthroughNotes?: string;
  selectedRoomType: RoomType;
  currentBuildingId: string;
  currentFloor: number;
  cleaningFrequency: CleaningFrequency;
  pricing: PricingInputs;
  proposalGeneratedAt?: string;
  proposalPdfPath?: string | null;
  savedAt?: string;
  updatedAt: string;
}

export interface RoomBreakdown {
  roomType: RoomType;
  count: number;
  minutes: number;
  hours: number;
  weeklyHours: number;
}

export interface EstimateTotals {
  totalRooms: number;
  totalMinutes: number;
  totalHours: number;
}

export interface StaffingTotals {
  visitsPerWeek: number;
  perVisitLaborHours: number;
  dailyLaborHours: number;
  weeklyLaborHours: number;
  monthlyLaborHours: number;
  annualLaborHours: number;
}

export interface CostSummary {
  monthlyDirectLaborCost: number;
  monthlyLoadedLaborCost: number;
  monthlyOverheadCost: number;
  monthlyCost: number;
  annualCost: number;
  recommendedMonthlyContract: number;
  recommendedAnnualContract: number;
  grossMonthlyProfit: number;
  grossAnnualProfit: number;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  createdAt?: string;
}

export interface FloorSummary {
  buildingId: string;
  buildingName: string;
  floorNumber: number;
  totals: EstimateTotals;
  staffing: StaffingTotals;
  cost: CostSummary;
}

export interface BuildingSummary {
  building: BuildingInfo;
  totals: EstimateTotals;
  staffing: StaffingTotals;
  cost: CostSummary;
  floorSummaries: FloorSummary[];
}
