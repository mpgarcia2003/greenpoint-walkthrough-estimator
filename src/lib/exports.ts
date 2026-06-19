"use client";

import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

import {
  facilityLabel,
  formatCurrency,
  formatNumber,
  getCostSummary,
  getEntryFloor,
  getFloorSummaries,
  getRoomBreakdown,
  getStaffingTotals,
  getTotals,
  normalizeCleaningFrequency,
} from "@/lib/calculations";
import type { EstimateDraft } from "@/lib/types";

type AutoTableDocument = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

type SpreadsheetCell = string | number;

function fileBaseName(estimate: EstimateDraft) {
  return facilityLabel(estimate.facility)
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
}

function getExportModel(estimate: EstimateDraft) {
  const defaultFrequency = normalizeCleaningFrequency(estimate.cleaningFrequency);
  const totals = getTotals(estimate.entries);
  const breakdown = getRoomBreakdown(estimate.entries, defaultFrequency);
  const staffing = getStaffingTotals(estimate.entries, defaultFrequency);
  const cost = getCostSummary(staffing, estimate.pricing);
  const floorSummaries = getFloorSummaries({
    entries: estimate.entries,
    numberOfFloors: estimate.facility.numberOfFloors,
    cleaningFrequency: defaultFrequency,
    pricing: estimate.pricing,
  });

  return { totals, breakdown, staffing, cost, defaultFrequency, floorSummaries };
}

function createPdfEstimateDocument(estimate: EstimateDraft) {
  const { totals, breakdown, staffing, cost, defaultFrequency, floorSummaries } =
    getExportModel(estimate);
  const doc = new jsPDF({ unit: "pt", format: "letter" }) as AutoTableDocument;
  const title = facilityLabel(estimate.facility);

  doc.setFillColor(7, 17, 15);
  doc.rect(0, 0, 612, 96, "F");
  doc.setTextColor(245, 247, 242);
  doc.setFontSize(20);
  doc.text("GreenPoint Walkthrough Estimator", 40, 40);
  doc.setFontSize(13);
  doc.text(title, 40, 64);

  autoTable(doc, {
    startY: 120,
    head: [["Facility Information", ""]],
    body: [
      ["Facility Name", estimate.facility.facilityName || "Not specified"],
      ["Client Name", estimate.facility.clientName || "Not specified"],
      ["Address", estimate.facility.address || "Not specified"],
      ["Square Footage", formatNumber(estimate.facility.squareFootage, 0)],
      ["Number of Floors", formatNumber(estimate.facility.numberOfFloors, 0)],
      ["Facility Type", estimate.facility.facilityType],
    ],
    theme: "grid",
    headStyles: { fillColor: [25, 51, 42] },
  });

  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY ?? 120) + 20,
    head: [["Room Type", "Rooms", "Minutes", "Hours", "Weekly Hours"]],
    body: breakdown.map((row) => [
      row.roomType,
      row.count,
      row.minutes,
      formatNumber(row.hours),
      formatNumber(row.weeklyHours),
    ]),
    foot: [
      [
        "Total",
        totals.totalRooms,
        totals.totalMinutes,
        totals.totalHours,
        staffing.weeklyLaborHours,
      ],
    ],
    theme: "striped",
    headStyles: { fillColor: [15, 23, 22] },
  });

  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY ?? 200) + 20,
    head: [["Staffing Estimate", "Hours"]],
    body: [
      ["Per Visit Labor Hours", formatNumber(staffing.perVisitLaborHours)],
      ["Default Cleaning Frequency", defaultFrequency],
      ["Avg Daily Labor Hours", formatNumber(staffing.dailyLaborHours)],
      ["Weekly Labor Hours", formatNumber(staffing.weeklyLaborHours)],
      ["Monthly Labor Hours", formatNumber(staffing.monthlyLaborHours)],
      ["Annual Labor Hours", formatNumber(staffing.annualLaborHours)],
    ],
    theme: "grid",
    headStyles: { fillColor: [25, 51, 42] },
  });

  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY ?? 300) + 20,
    head: [["Pricing Summary", "Amount"]],
    body: [
      ["Direct Labor Cost", formatCurrency(cost.monthlyDirectLaborCost)],
      ["Loaded Labor Cost", formatCurrency(cost.monthlyLoadedLaborCost)],
      ["Monthly Cost", formatCurrency(cost.monthlyCost)],
      ["Annual Cost", formatCurrency(cost.annualCost)],
      ["Monthly Profit", formatCurrency(cost.grossMonthlyProfit)],
      ["Annual Profit", formatCurrency(cost.grossAnnualProfit)],
      [
        "Recommended Monthly Contract Price",
        formatCurrency(cost.recommendedMonthlyContract),
      ],
      [
        "Recommended Annual Contract Price",
        formatCurrency(cost.recommendedAnnualContract),
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [25, 51, 42] },
  });

  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY ?? 400) + 20,
    head: [["Room Log", "Floor", "Minutes", "Cleaning Frequency"]],
    body: estimate.entries.map((entry) => [
      `${entry.roomType} #${entry.roomNumber}`,
      getEntryFloor(entry),
      entry.minutes,
      entry.cleaningFrequency
        ? normalizeCleaningFrequency(entry.cleaningFrequency)
        : `Default: ${defaultFrequency}`,
    ]),
    theme: "striped",
    headStyles: { fillColor: [15, 23, 22] },
  });

  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY ?? 500) + 20,
    head: [["Floor", "Rooms", "Minutes", "Monthly Price", "Monthly Profit"]],
    body: floorSummaries.map((floor) => [
      `Floor ${floor.floorNumber}`,
      floor.totals.totalRooms,
      floor.totals.totalMinutes,
      formatCurrency(floor.cost.recommendedMonthlyContract),
      formatCurrency(floor.cost.grossMonthlyProfit),
    ]),
    theme: "grid",
    headStyles: { fillColor: [25, 51, 42] },
  });

  return doc;
}

export function getPdfEstimateFileName(estimate: EstimateDraft) {
  return `${fileBaseName(estimate) || "greenpoint-estimate"}.pdf`;
}

export function createPdfEstimateBlob(estimate: EstimateDraft) {
  return createPdfEstimateDocument(estimate).output("blob");
}

export function exportPdfEstimate(estimate: EstimateDraft) {
  const fileName = getPdfEstimateFileName(estimate);
  downloadBlob(createPdfEstimateBlob(estimate), fileName);

  return fileName;
}

export function exportExcelEstimate(estimate: EstimateDraft) {
  const { totals, breakdown, staffing, cost, defaultFrequency, floorSummaries } =
    getExportModel(estimate);
  const workbook = createExcelWorkbook([
    {
      name: "Facility",
      rows: [
        ["Facility Name", estimate.facility.facilityName],
        ["Client Name", estimate.facility.clientName],
        ["Address", estimate.facility.address],
        ["Square Footage", estimate.facility.squareFootage],
        ["Number of Floors", estimate.facility.numberOfFloors],
        ["Facility Type", estimate.facility.facilityType],
      ],
    },
    {
      name: "Room Log",
      rows: [
        ["Room", "Floor", "Room Type", "Minutes", "Hours", "Cleaning Frequency"],
        ...estimate.entries.map((entry) => [
          `${entry.roomType} #${entry.roomNumber}`,
          getEntryFloor(entry),
          entry.roomType,
          entry.minutes,
          entry.minutes / 60,
          entry.cleaningFrequency
            ? normalizeCleaningFrequency(entry.cleaningFrequency)
            : `Default: ${defaultFrequency}`,
        ]),
      ],
    },
    {
      name: "Floors",
      rows: [
        [
          "Floor",
          "Rooms",
          "Minutes",
          "Hours",
          "Weekly Labor Hours",
          "Monthly Price",
          "Annual Price",
          "Monthly Profit",
          "Annual Profit",
        ],
        ...floorSummaries.map((floor) => [
          floor.floorNumber,
          floor.totals.totalRooms,
          floor.totals.totalMinutes,
          floor.totals.totalHours,
          floor.staffing.weeklyLaborHours,
          floor.cost.recommendedMonthlyContract,
          floor.cost.recommendedAnnualContract,
          floor.cost.grossMonthlyProfit,
          floor.cost.grossAnnualProfit,
        ]),
      ],
    },
    {
      name: "Breakdown",
      rows: [
        ["Room Type", "Rooms", "Minutes", "Hours", "Weekly Hours"],
        ...breakdown.map((row) => [
          row.roomType,
          row.count,
          row.minutes,
          row.hours,
          row.weeklyHours,
        ]),
      ],
    },
    {
      name: "Labor",
      rows: [
        ["Total Rooms", totals.totalRooms],
        ["Total Minutes", totals.totalMinutes],
        ["Total Hours", totals.totalHours],
        ["Default Cleaning Frequency", defaultFrequency],
        ["Avg Daily Labor Hours", staffing.dailyLaborHours],
        ["Weekly Labor Hours", staffing.weeklyLaborHours],
        ["Monthly Labor Hours", staffing.monthlyLaborHours],
        ["Annual Labor Hours", staffing.annualLaborHours],
      ],
    },
    {
      name: "Pricing",
      rows: [
        ["Hourly Wage", estimate.pricing.hourlyWage],
        ["Payroll Burden %", estimate.pricing.payrollBurdenPercent],
        ["Overhead %", estimate.pricing.overheadPercent],
        ["Profit %", estimate.pricing.profitPercent],
        ["Direct Labor Cost", cost.monthlyDirectLaborCost],
        ["Loaded Labor Cost", cost.monthlyLoadedLaborCost],
        ["Monthly Cost", cost.monthlyCost],
        ["Annual Cost", cost.annualCost],
        ["Monthly Profit", cost.grossMonthlyProfit],
        ["Annual Profit", cost.grossAnnualProfit],
        ["Recommended Monthly Contract Price", cost.recommendedMonthlyContract],
        ["Recommended Annual Contract Price", cost.recommendedAnnualContract],
      ],
    },
  ]);

  const fileName = `${fileBaseName(estimate) || "greenpoint-estimate"}.xls`;

  downloadTextFile(
    workbook,
    fileName,
    "application/vnd.ms-excel;charset=utf-8",
  );

  return fileName;
}

function xmlEscape(value: SpreadsheetCell) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sheetName(name: string) {
  return name.replace(/[\\/?*:[\]]/g, " ").slice(0, 31) || "Sheet";
}

function createExcelWorkbook(
  sheets: Array<{ name: string; rows: SpreadsheetCell[][] }>,
) {
  const worksheets = sheets
    .map(
      (sheet) => `
  <Worksheet ss:Name="${xmlEscape(sheetName(sheet.name))}">
    <Table>
      ${sheet.rows
        .map(
          (row) => `<Row>${row
            .map((cell) => {
              const isNumeric = typeof cell === "number" && Number.isFinite(cell);
              return `<Cell><Data ss:Type="${isNumeric ? "Number" : "String"}">${xmlEscape(cell)}</Data></Cell>`;
            })
            .join("")}</Row>`,
        )
        .join("")}
    </Table>
  </Worksheet>`,
    )
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Aptos" ss:Size="11"/>
    </Style>
  </Styles>
  ${worksheets}
</Workbook>`;
}

function csvEscape(value: string | number) {
  const normalized = String(value ?? "");

  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

export function exportCsvEstimate(estimate: EstimateDraft) {
  const { totals, breakdown, staffing, cost, defaultFrequency, floorSummaries } =
    getExportModel(estimate);
  const rows: Array<Array<string | number>> = [
    ["GreenPoint Walkthrough Estimator"],
    [],
    ["Facility Information"],
    ["Facility Name", estimate.facility.facilityName],
    ["Client Name", estimate.facility.clientName],
    ["Address", estimate.facility.address],
    ["Square Footage", estimate.facility.squareFootage],
    ["Number of Floors", estimate.facility.numberOfFloors],
    ["Facility Type", estimate.facility.facilityType],
    [],
    ["Room Breakdown"],
    ["Room Type", "Rooms", "Minutes", "Hours", "Weekly Hours"],
    ...breakdown.map((row) => [
      row.roomType,
      row.count,
      row.minutes,
      row.hours,
      row.weeklyHours,
    ]),
    [
      "Total",
      totals.totalRooms,
      totals.totalMinutes,
      totals.totalHours,
      staffing.weeklyLaborHours,
    ],
    [],
    ["Floor Summary"],
    [
      "Floor",
      "Rooms",
      "Minutes",
      "Hours",
      "Weekly Labor Hours",
      "Monthly Price",
      "Annual Price",
      "Monthly Profit",
      "Annual Profit",
    ],
    ...floorSummaries.map((floor) => [
      floor.floorNumber,
      floor.totals.totalRooms,
      floor.totals.totalMinutes,
      floor.totals.totalHours,
      floor.staffing.weeklyLaborHours,
      floor.cost.recommendedMonthlyContract,
      floor.cost.recommendedAnnualContract,
      floor.cost.grossMonthlyProfit,
      floor.cost.grossAnnualProfit,
    ]),
    [],
    ["Room Log"],
    ["Room", "Floor", "Room Type", "Minutes", "Cleaning Frequency"],
    ...estimate.entries.map((entry) => [
      `${entry.roomType} #${entry.roomNumber}`,
      getEntryFloor(entry),
      entry.roomType,
      entry.minutes,
      entry.cleaningFrequency
        ? normalizeCleaningFrequency(entry.cleaningFrequency)
        : `Default: ${defaultFrequency}`,
    ]),
    [],
    ["Staffing Estimate"],
    ["Default Cleaning Frequency", defaultFrequency],
    ["Avg Daily Labor Hours", staffing.dailyLaborHours],
    ["Weekly Labor Hours", staffing.weeklyLaborHours],
    ["Monthly Labor Hours", staffing.monthlyLaborHours],
    ["Annual Labor Hours", staffing.annualLaborHours],
    [],
    ["Pricing Summary"],
    ["Direct Labor Cost", cost.monthlyDirectLaborCost],
    ["Loaded Labor Cost", cost.monthlyLoadedLaborCost],
    ["Monthly Cost", cost.monthlyCost],
    ["Annual Cost", cost.annualCost],
    ["Monthly Profit", cost.grossMonthlyProfit],
    ["Annual Profit", cost.grossAnnualProfit],
    ["Recommended Monthly Contract Price", cost.recommendedMonthlyContract],
    ["Recommended Annual Contract Price", cost.recommendedAnnualContract],
  ];

  const fileName = `${fileBaseName(estimate) || "greenpoint-estimate"}.csv`;
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");

  downloadTextFile(`\ufeff${csv}`, fileName, "text/csv;charset=utf-8");

  return fileName;
}

function downloadTextFile(content: string, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  downloadBlob(blob, fileName);
}

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
