import type {
  BuildingInfo,
  CleaningFrequency,
  FacilityInfo,
  FacilityType,
  PricingInputs,
  RoomType,
} from "@/lib/types";

export const FACILITY_TYPES: FacilityType[] = [
  "School",
  "College",
  "Office Building",
  "Government Building",
  "Airport",
  "Warehouse",
  "Manufacturing Facility",
  "Hospital",
  "Medical Office",
  "Retail",
  "Other",
];

export const ROOM_TYPES: RoomType[] = [
  "Classroom",
  "Office",
  "Bathroom",
  "Lab",
  "Conference Room",
  "Theater",
  "Performance Center",
  "Gym",
  "Locker Room",
  "Dressing Room",
  "Hallway",
  "Stairwell",
  "Cafeteria",
  "Kitchen",
  "Warehouse Area",
  "Production Floor",
  "Break Room",
  "Reception Area",
  "Medical Exam Room",
  "Patient Room",
  "Storage Room",
  "Other",
];

export const MINUTE_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

export const FREQUENCY_OPTIONS: Array<{
  value: CleaningFrequency;
  visitsPerWeek: number;
  label: string;
}> = [
  { value: "1 day/week", visitsPerWeek: 1, label: "1 day/week" },
  { value: "2 days/week", visitsPerWeek: 2, label: "2 days/week" },
  { value: "3 days/week", visitsPerWeek: 3, label: "3 days/week" },
  { value: "4 days/week", visitsPerWeek: 4, label: "4 days/week" },
  { value: "5 days/week", visitsPerWeek: 5, label: "5 days/week" },
  { value: "6 days/week", visitsPerWeek: 6, label: "6 days/week" },
  { value: "7 days/week", visitsPerWeek: 7, label: "7 days/week" },
  { value: "Bi-weekly", visitsPerWeek: 0.5, label: "Bi-weekly" },
  { value: "Monthly", visitsPerWeek: 12 / 52, label: "Monthly" },
];

export const DEFAULT_FACILITY: FacilityInfo = {
  facilityName: "",
  clientName: "",
  address: "",
  squareFootage: 0,
  numberOfFloors: 1,
  facilityType: "School",
};

export const DEFAULT_BUILDING_ID = "main-building";

export const DEFAULT_BUILDINGS: BuildingInfo[] = [
  {
    id: DEFAULT_BUILDING_ID,
    name: "Main Building",
    numberOfFloors: 1,
  },
];

export const DEFAULT_PRICING: PricingInputs = {
  hourlyWage: 22,
  payrollBurdenPercent: 25,
  overheadPercent: 15,
  profitPercent: 20,
};

export const ACTIVE_ESTIMATE_ID = "greenpoint-active-estimate";
