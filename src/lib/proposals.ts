"use client";

import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

import {
  facilityLabel,
  formatCurrency,
  formatNumber,
  getBuildingSummaries,
  getCostSummary,
  getFloorSummaries,
  getRoomBreakdown,
  getStaffingTotals,
  getTotals,
  normalizeBuildings,
  normalizeCleaningFrequency,
} from "@/lib/calculations";
import type { BuildingSummary, EstimateDraft, FloorSummary } from "@/lib/types";

type AutoTableDocument = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

type ColorTuple = [number, number, number];

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 64;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const DARK: ColorTuple = [19, 63, 70];
const TEAL: ColorTuple = [31, 86, 99];
const LIGHT_TEAL: ColorTuple = [139, 192, 195];
const GOLD: ColorTuple = [178, 128, 57];
const INK: ColorTuple = [34, 40, 44];
const MUTED: ColorTuple = [91, 111, 121];
const CALLOUT: ColorTuple = [236, 246, 247];
const BORDER: ColorTuple = [206, 221, 224];

const CONTENTS = [
  "Letter of Introduction",
  "Executive Overview",
  "About the Service Provider",
  "Why This Program",
  "The Facility in Scope",
  "Understanding the Environment",
  "Scope of Services",
  "Service Schedule & Staffing",
  "Walkthrough Breakdown",
  "Building & Floor Financials",
  "Pricing",
  "Service Agreement Terms",
  "Signature Page",
];

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

function fileBaseName(estimate: EstimateDraft) {
  return facilityLabel(estimate.facility)
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
}

function cleanText(value?: string) {
  return value?.trim() || "Not specified";
}

function reportTitle(estimate: EstimateDraft) {
  const client = estimate.facility.clientName.trim();
  const facility = estimate.facility.facilityName.trim();

  if (client && facility) {
    return `${client} / ${facility}`;
  }

  return client || facility || "Client Facility";
}

function getProposalModel(estimate: EstimateDraft) {
  const defaultFrequency = normalizeCleaningFrequency(estimate.cleaningFrequency);
  const buildings = normalizeBuildings(
    estimate.buildings,
    estimate.facility.numberOfFloors,
  );
  const totals = getTotals(estimate.entries);
  const staffing = getStaffingTotals(estimate.entries, defaultFrequency);
  const cost = getCostSummary(staffing, estimate.pricing);
  const breakdown = getRoomBreakdown(estimate.entries, defaultFrequency);
  const buildingSummaries = getBuildingSummaries({
    buildings,
    cleaningFrequency: defaultFrequency,
    entries: estimate.entries,
    pricing: estimate.pricing,
  });
  const floorSummaries = getFloorSummaries({
    building: buildings[0],
    cleaningFrequency: defaultFrequency,
    entries: estimate.entries,
    pricing: estimate.pricing,
  });

  return {
    breakdown,
    buildingSummaries,
    buildings,
    cost,
    defaultFrequency,
    floorSummaries,
    staffing,
    totals,
  };
}

function setRgb(
  doc: jsPDF,
  method: "setFillColor" | "setTextColor" | "setDrawColor",
  color: ColorTuple,
) {
  doc[method](color[0], color[1], color[2]);
}

function drawWrappedText({
  doc,
  text,
  x = MARGIN_X,
  y,
  width = CONTENT_WIDTH,
  lineHeight = 15,
}: {
  doc: jsPDF;
  text: string;
  x?: number;
  y: number;
  width?: number;
  lineHeight?: number;
}) {
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, x, y);

  return y + lines.length * lineHeight;
}

function addSectionPage(doc: jsPDF, section: string, title: string) {
  doc.addPage("letter", "portrait");
  setRgb(doc, "setTextColor", TEAL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(section.toUpperCase(), MARGIN_X, 78, { charSpace: 2 });
  doc.setFont("times", "bold");
  doc.setFontSize(25);
  doc.text(title, MARGIN_X, 114);
  setRgb(doc, "setDrawColor", GOLD);
  doc.setLineWidth(2);
  doc.line(MARGIN_X, 130, MARGIN_X + 54, 130);
  setRgb(doc, "setTextColor", INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  return 168;
}

function addCallout(
  doc: jsPDF,
  title: string,
  body: string,
  x: number,
  y: number,
  width: number,
  minHeight = 86,
) {
  const titleLines = doc.splitTextToSize(title, width - 28);
  const bodyLines = doc.splitTextToSize(body, width - 28);
  const height = Math.max(
    minHeight,
    34 + titleLines.length * 14 + bodyLines.length * 14,
  );

  setRgb(doc, "setFillColor", CALLOUT);
  doc.roundedRect(x, y, width, height, 4, 4, "F");
  setRgb(doc, "setDrawColor", TEAL);
  doc.setLineWidth(2);
  doc.line(x, y, x, y + height);
  setRgb(doc, "setTextColor", TEAL);
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text(titleLines, x + 16, y + 24);
  setRgb(doc, "setTextColor", INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text(bodyLines, x + 16, y + 48);

  return y + height;
}

function addSimpleTable({
  doc,
  head,
  body,
  startY,
  columnStyles,
}: {
  doc: AutoTableDocument;
  head: string[];
  body: Array<Array<string | number>>;
  startY: number;
  columnStyles?: Record<number, { cellWidth?: number; halign?: "left" | "right" | "center" }>;
}) {
  autoTable(doc, {
    body,
    columnStyles,
    head: [head],
    headStyles: {
      fillColor: DARK,
      font: "times",
      fontSize: 9,
      fontStyle: "bold",
      textColor: [255, 255, 255],
    },
    margin: { left: MARGIN_X, right: MARGIN_X },
    startY,
    styles: {
      cellPadding: 8,
      font: "helvetica",
      fontSize: 9.5,
      lineColor: BORDER,
      lineWidth: 0.4,
      textColor: INK,
    },
    theme: "grid",
  });

  return (doc.lastAutoTable?.finalY ?? startY) + 18;
}

function addBulletList(
  doc: jsPDF,
  items: Array<{ label: string; body: string }>,
  y: number,
) {
  let nextY = y;

  items.forEach((item) => {
    setRgb(doc, "setFillColor", GOLD);
    doc.circle(MARGIN_X + 4, nextY - 4, 3, "F");
    setRgb(doc, "setTextColor", TEAL);
    doc.setFont("times", "bold");
    doc.setFontSize(10.5);
    doc.text(`${item.label} `, MARGIN_X + 18, nextY);
    setRgb(doc, "setTextColor", INK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    nextY = drawWrappedText({
      doc,
      lineHeight: 14,
      text: item.body,
      width: CONTENT_WIDTH - 145,
      x: MARGIN_X + 140,
      y: nextY,
    });
    setRgb(doc, "setDrawColor", BORDER);
    doc.setLineWidth(0.4);
    doc.line(MARGIN_X, nextY + 4, PAGE_WIDTH - MARGIN_X, nextY + 4);
    nextY += 22;
  });

  return nextY;
}

function addCover(doc: jsPDF, estimate: EstimateDraft) {
  const model = getProposalModel(estimate);

  setRgb(doc, "setFillColor", DARK);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");
  setRgb(doc, "setTextColor", [188, 230, 224]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("F O R M A L  P R O P O S A L", MARGIN_X, 86);

  doc.setFont("times", "bold");
  doc.setFontSize(37);
  doc.setTextColor(255, 255, 255);
  doc.text("Sanitation Services", MARGIN_X, 148);
  setRgb(doc, "setTextColor", LIGHT_TEAL);
  doc.text("Proposal", MARGIN_X, 192);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  setRgb(doc, "setTextColor", [210, 229, 226]);
  drawWrappedText({
    doc,
    lineHeight: 16,
    text:
      "A formal janitorial and sanitation services proposal generated from the walkthrough estimate, labor model, staffing plan, and pricing summary captured in the estimator workspace.",
    width: 420,
    y: 238,
  });

  const preparedY = 344;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  setRgb(doc, "setTextColor", LIGHT_TEAL);
  doc.text("P R E P A R E D  F O R", MARGIN_X, preparedY);
  doc.text("P R E P A R E D  B Y", 326, preparedY);
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(cleanText(estimate.facility.clientName), MARGIN_X, preparedY + 28, {
    maxWidth: 210,
  });
  doc.text("Service Provider", 326, preparedY + 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  setRgb(doc, "setTextColor", [214, 229, 226]);
  doc.text(cleanText(estimate.facility.facilityName), MARGIN_X, preparedY + 52, {
    maxWidth: 210,
  });
  doc.text(cleanText(estimate.facility.address), MARGIN_X, preparedY + 70, {
    maxWidth: 210,
  });
  doc.text("Generated by Walkthrough Estimator", 326, preparedY + 52);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 326, preparedY + 70);

  const cards = [
    {
      label: "MONTHLY CONTRACT",
      value: formatCurrency(model.cost.recommendedMonthlyContract),
    },
    {
      label: "SERVICE FREQUENCY",
      value: model.defaultFrequency,
    },
    {
      label: "LABOR HOURS / MONTH",
      value: formatNumber(model.staffing.monthlyLaborHours),
    },
  ];
  const cardY = 530;
  const cardW = 148;

  cards.forEach((card, index) => {
    const x = MARGIN_X + index * (cardW + 20);
    setRgb(doc, "setFillColor", [29, 79, 86]);
    setRgb(doc, "setDrawColor", [79, 118, 120]);
    doc.roundedRect(x, cardY, cardW, 74, 4, 4, "FD");
    doc.setFont("times", "bold");
    doc.setFontSize(19);
    doc.setTextColor(255, 255, 255);
    doc.text(card.value, x + cardW / 2, cardY + 32, {
      align: "center",
      maxWidth: cardW - 18,
    });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setRgb(doc, "setTextColor", [188, 219, 217]);
    doc.text(card.label, x + cardW / 2, cardY + 55, {
      align: "center",
      maxWidth: cardW - 20,
    });
  });

  setRgb(doc, "setDrawColor", [112, 148, 149]);
  doc.setLineWidth(0.8);
  doc.line(MARGIN_X, 708, PAGE_WIDTH - MARGIN_X, 708);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setRgb(doc, "setTextColor", [198, 220, 217]);
  doc.text(
    "Submitted as a fixed-price commercial cleaning proposal with staffing, scope, and pricing generated from field walkthrough data.",
    MARGIN_X,
    734,
    { maxWidth: CONTENT_WIDTH },
  );
}

function addTableOfContents(doc: jsPDF) {
  let y = addSectionPage(doc, "Contents", "Table of Contents");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  CONTENTS.forEach((item, index) => {
    const number = String(index + 1).padStart(2, "0");
    setRgb(doc, "setTextColor", TEAL);
    doc.setFont("times", "bold");
    doc.text(number, MARGIN_X, y);
    setRgb(doc, "setTextColor", INK);
    doc.setFont("helvetica", "normal");
    doc.text(item, MARGIN_X + 42, y);
    setRgb(doc, "setDrawColor", BORDER);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_X, y + 18, PAGE_WIDTH - MARGIN_X, y + 18);
    y += 32;
  });
}

function addLetter(doc: jsPDF, estimate: EstimateDraft) {
  let y = addSectionPage(doc, "Section 01", "Letter of Introduction");
  const client = estimate.facility.clientName.trim() || "Client";

  y = drawWrappedText({
    doc,
    text: `Dear ${client} team,`,
    y,
  }) + 8;
  y = drawWrappedText({
    doc,
    lineHeight: 16,
    text:
      "Thank you for the opportunity to present this sanitation services proposal. This document converts the walkthrough observations, room-by-room cleaning times, labor requirements, and pricing model into a formal service program for review.",
    y,
  }) + 10;
  y = drawWrappedText({
    doc,
    lineHeight: 16,
    text:
      "The program is structured to provide predictable service, clear scope accountability, and a fixed monthly price based on the current facility profile. Any special conditions or periodic service items entered during the walkthrough are highlighted in the notes section.",
    y,
  }) + 22;
  doc.setFont("helvetica", "normal");
  doc.text("Respectfully submitted,", MARGIN_X, y);
  setRgb(doc, "setTextColor", TEAL);
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.text("Service Provider", MARGIN_X, y + 34);
  setRgb(doc, "setTextColor", INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text("Generated by Walkthrough Estimator", MARGIN_X, y + 52);
}

function addExecutiveOverview(doc: jsPDF, estimate: EstimateDraft) {
  const model = getProposalModel(estimate);
  let y = addSectionPage(doc, "Section 02", "Executive Overview");

  y = drawWrappedText({
    doc,
    lineHeight: 16,
    text: `${reportTitle(estimate)} requires a structured janitorial service plan sized to the facility layout, cleaning frequency, and room-level labor assumptions captured during the walkthrough.`,
    y,
  }) + 10;
  y = drawWrappedText({
    doc,
    lineHeight: 16,
    text:
      "This proposal is built around a one-tap estimating workflow: each room entry contributes to the labor model, staffing totals, and recommended contract pricing shown in the pages that follow.",
    y,
  }) + 24;

  const cardY = y;
  [
    [formatCurrency(model.cost.recommendedMonthlyContract), "MONTHLY FIXED FEE"],
    [model.defaultFrequency, "DEFAULT CLEANING FREQUENCY"],
    [formatNumber(model.totals.totalRooms, 0), "ROOMS DOCUMENTED"],
  ].forEach(([value, label], index) => {
    const x = MARGIN_X + index * 168;
    setRgb(doc, "setDrawColor", BORDER);
    doc.roundedRect(x, cardY, 150, 72, 4, 4, "S");
    setRgb(doc, "setDrawColor", TEAL);
    doc.setLineWidth(2);
    doc.line(x, cardY, x + 150, cardY);
    setRgb(doc, "setTextColor", TEAL);
    doc.setFont("times", "bold");
    doc.setFontSize(19);
    doc.text(value, x + 75, cardY + 30, { align: "center", maxWidth: 132 });
    setRgb(doc, "setTextColor", MUTED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(label, x + 75, cardY + 52, { align: "center", maxWidth: 130 });
  });

  addCallout(
    doc,
    "Program objective",
    "Deliver a clean, consistent, and accountable facility maintenance program with transparent labor assumptions and a fixed commercial price.",
    MARGIN_X,
    cardY + 102,
    CONTENT_WIDTH,
  );
}

function addAboutProvider(doc: jsPDF) {
  let y = addSectionPage(doc, "Section 03", "About the Service Provider");

  y = drawWrappedText({
    doc,
    lineHeight: 16,
    text:
      "This proposal template is designed for professional janitorial contractors serving commercial, institutional, government, healthcare, industrial, education, retail, and multi-building environments.",
    y,
  }) + 12;
  y = drawWrappedText({
    doc,
    lineHeight: 16,
    text:
      "The operating model emphasizes documented scopes, trained personnel, consistent supervision, quality checks, and clear communication with the client throughout the contract term.",
    y,
  }) + 22;

  addSimpleTable({
    body: [
      [
        "Operating Focus",
        "Janitorial service, sanitation, floor care, trash removal, restrooms, office areas, production spaces, and periodic services.",
      ],
      [
        "Service Area",
        "Configured by the organization using the SaaS workspace and proposal settings.",
      ],
      [
        "Quality System",
        "Walkthrough data, room logs, staffing calculations, saved proposals, and future photo/QR/AI verification modules.",
      ],
    ],
    doc: doc as AutoTableDocument,
    head: ["Credential", "Detail"],
    startY: y,
  });
}

function addWhyProgram(doc: jsPDF) {
  const y = addSectionPage(doc, "Section 04", "Why This Program");

  addBulletList(
    doc,
    [
      {
        body:
          "Labor is built from actual room-level walkthrough data rather than broad assumptions.",
        label: "Measured estimating.",
      },
      {
        body:
          "Room types, minutes, frequencies, buildings, and floors remain editable so the estimate can evolve as the scope becomes clearer.",
        label: "Flexible scope.",
      },
      {
        body:
          "The price model separates direct labor, payroll burden, overhead, and target profit for transparent review.",
        label: "Pricing clarity.",
      },
      {
        body:
          "Saved walkthroughs and generated proposal PDFs can be retrieved from the dashboard for future revisions.",
        label: "Reusable record.",
      },
      {
        body:
          "The architecture is ready for voice input, room photos, QR scans, AI recommendations, and multi-user company workflows.",
        label: "Future-ready.",
      },
    ],
    y,
  );
}

function addFacilityScope(doc: jsPDF, estimate: EstimateDraft) {
  const model = getProposalModel(estimate);
  let y = addSectionPage(doc, "Section 05", "The Facility in Scope");

  y = drawWrappedText({
    doc,
    lineHeight: 16,
    text:
      "The following facility information is pulled directly from the walkthrough record and should be reviewed before the proposal is issued to the client.",
    y,
  }) + 22;

  addSimpleTable({
    body: [
      ["Client", cleanText(estimate.facility.clientName)],
      ["Facility", cleanText(estimate.facility.facilityName)],
      ["Address", cleanText(estimate.facility.address)],
      ["Facility Type", estimate.facility.facilityType],
      ["Square Footage", formatNumber(estimate.facility.squareFootage, 0)],
      ["Buildings", formatNumber(model.buildings.length, 0)],
      ["Floors", formatNumber(estimate.facility.numberOfFloors, 0)],
      ["Total Rooms Documented", formatNumber(model.totals.totalRooms, 0)],
    ],
    doc: doc as AutoTableDocument,
    head: ["Facility Element", "Detail"],
    startY: y,
  });
}

function addEnvironment(doc: jsPDF, estimate: EstimateDraft) {
  let y = addSectionPage(doc, "Section 06", "Understanding the Environment");
  const notes = estimate.walkthroughNotes?.trim();

  y = drawWrappedText({
    doc,
    lineHeight: 16,
    text:
      "A successful cleaning program depends on understanding the facility type, building layout, room mix, access expectations, periodic service requirements, and any special conditions observed during the walkthrough.",
    y,
  }) + 18;

  y = addCallout(
    doc,
    "Walkthrough notes",
    notes ||
      "No special notes were entered. Add periodic services, access restrictions, client preferences, or unusual cleaning needs before generating the final client proposal.",
    MARGIN_X,
    y,
    CONTENT_WIDTH,
    116,
  ) + 26;

  addSimpleTable({
    body: [
      ["Default Frequency", normalizeCleaningFrequency(estimate.cleaningFrequency)],
      ["Special Frequencies", `${estimate.entries.filter((entry) => entry.cleaningFrequency).length} room-specific overrides`],
      ["Primary Data Source", "Room entries, minutes, buildings, floors, and pricing assumptions captured during walkthrough."],
    ],
    doc: doc as AutoTableDocument,
    head: ["Planning Item", "Detail"],
    startY: y,
  });
}

function addScope(doc: jsPDF, estimate: EstimateDraft) {
  const model = getProposalModel(estimate);
  const roomTypes = model.breakdown.map((row) => row.roomType).slice(0, 8);
  let y = addSectionPage(doc, "Section 07", "Scope of Services");

  y = drawWrappedText({
    doc,
    lineHeight: 16,
    text: `The proposed scope covers recurring janitorial service for ${roomTypes.length ? roomTypes.join(", ") : "the documented facility areas"}. Final task lists should be confirmed during mobilization.`,
    y,
  }) + 18;

  y = addBulletList(
    doc,
    [
      {
        body: "Clean and sanitize assigned spaces based on the approved schedule.",
        label: "General cleaning.",
      },
      {
        body: "Sweep, mop, polish, and maintain floor surfaces according to area need.",
        label: "Floor care.",
      },
      {
        body: "Empty receptacles, remove trash, and replace liners where required.",
        label: "Trash removal.",
      },
      {
        body: "Dust furniture, fixtures, vents, ledges, touchpoints, and surfaces.",
        label: "Dusting.",
      },
      {
        body: "Clean mirrors, interior glass, entry glass, and visible smudges.",
        label: "Glass care.",
      },
      {
        body: "Report maintenance issues, damage, or client concerns to management.",
        label: "Issue reporting.",
      },
    ],
    y,
  );

  addCallout(
    doc,
    "Expanded support, same relationship",
    "Periodic services such as window cleaning, project floor work, emergency response, or specialty cleaning can be quoted separately and added to the active client record.",
    MARGIN_X,
    Math.min(y, 660),
    CONTENT_WIDTH,
    86,
  );
}

function addScheduleStaffing(doc: jsPDF, estimate: EstimateDraft) {
  const model = getProposalModel(estimate);
  let y = addSectionPage(doc, "Section 08", "Service Schedule & Staffing");

  y = drawWrappedText({
    doc,
    lineHeight: 16,
    text:
      "The staffing plan is sized from the room log and cleaning frequency. Room-specific frequency overrides are included in the weekly, monthly, and annual labor calculations.",
    y,
  }) + 20;

  y = addSimpleTable({
    body: [
      ["Default Cleaning Frequency", model.defaultFrequency],
      ["Per Visit Labor Hours", formatNumber(model.staffing.perVisitLaborHours)],
      ["Average Daily Labor Hours", formatNumber(model.staffing.dailyLaborHours)],
      ["Weekly Labor Hours", formatNumber(model.staffing.weeklyLaborHours)],
      ["Monthly Labor Hours", formatNumber(model.staffing.monthlyLaborHours)],
      ["Annual Labor Hours", formatNumber(model.staffing.annualLaborHours)],
    ],
    doc: doc as AutoTableDocument,
    head: ["Staffing Metric", "Hours"],
    startY: y,
  });

  addSimpleTable({
    body: [
      [
        "Lead Cleaner(s)",
        "Recurring cleaning, sanitation, trash removal, floor care, touchpoints, and route completion.",
      ],
      [
        "Site Supervisor / Account Manager",
        "Inspections, communication, issue follow-up, scheduling, and quality oversight.",
      ],
    ],
    doc: doc as AutoTableDocument,
    head: ["Role", "Primary Responsibility"],
    startY: (doc as AutoTableDocument).lastAutoTable?.finalY
      ? (doc as AutoTableDocument).lastAutoTable!.finalY + 24
      : y + 24,
  });
}

function addWalkthroughBreakdown(doc: jsPDF, estimate: EstimateDraft) {
  const model = getProposalModel(estimate);
  const y = addSectionPage(doc, "Section 09", "Walkthrough Breakdown");

  addSimpleTable({
    body: model.breakdown.map((row) => [
      row.roomType,
      row.count,
      row.minutes,
      formatNumber(row.hours),
      formatNumber(row.weeklyHours),
    ]),
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    doc: doc as AutoTableDocument,
    head: ["Room Type", "Rooms", "Minutes", "Visit Hours", "Weekly Hours"],
    startY: y,
  });

  addCallout(
    doc,
    "Room-level pricing foundation",
    "Every room in the log contributes to the labor hours and pricing model. Editing a room, changing its minutes, or applying a custom frequency changes the proposal economics.",
    MARGIN_X,
    ((doc as AutoTableDocument).lastAutoTable?.finalY ?? y) + 24,
    CONTENT_WIDTH,
    90,
  );
}

function addFinancials(doc: jsPDF, estimate: EstimateDraft) {
  const model = getProposalModel(estimate);
  let y = addSectionPage(doc, "Section 10", "Building & Floor Financials");

  y = drawWrappedText({
    doc,
    lineHeight: 16,
    text:
      "Where a walkthrough includes multiple buildings or floors, the SaaS separates the labor and financial model by area while preserving the total proposal price.",
    y,
  }) + 18;

  y = addSimpleTable({
    body: model.buildingSummaries.map((summary: BuildingSummary) => [
      summary.building.name,
      summary.totals.totalRooms,
      summary.totals.totalMinutes,
      formatNumber(summary.staffing.monthlyLaborHours),
      formatCurrency(summary.cost.recommendedMonthlyContract),
    ]),
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    doc: doc as AutoTableDocument,
    head: ["Building", "Rooms", "Minutes", "Monthly Hours", "Monthly Price"],
    startY: y,
  });

  const floorRows = model.buildingSummaries
    .flatMap((summary) => summary.floorSummaries)
    .slice(0, 10);

  addSimpleTable({
    body: floorRows.map((summary: FloorSummary) => [
      summary.buildingName,
      `Floor ${summary.floorNumber}`,
      summary.totals.totalRooms,
      summary.totals.totalMinutes,
      formatCurrency(summary.cost.recommendedMonthlyContract),
    ]),
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    doc: doc as AutoTableDocument,
    head: ["Building", "Floor", "Rooms", "Minutes", "Monthly Price"],
    startY: y,
  });
}

function addPricing(doc: jsPDF, estimate: EstimateDraft) {
  const model = getProposalModel(estimate);
  let y = addSectionPage(doc, "Section 11", "Pricing");

  setRgb(doc, "setFillColor", TEAL);
  doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, 146, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(214, 236, 235);
  doc.text("F I X E D  M O N T H L Y  S A N I T A T I O N  F E E", PAGE_WIDTH / 2, y + 34, {
    align: "center",
  });
  doc.setFont("times", "bold");
  doc.setFontSize(38);
  doc.setTextColor(255, 255, 255);
  doc.text(formatCurrency(model.cost.recommendedMonthlyContract), PAGE_WIDTH / 2, y + 78, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    `per month - ${formatCurrency(model.cost.recommendedAnnualContract)} annually`,
    PAGE_WIDTH / 2,
    y + 106,
    { align: "center" },
  );
  doc.setFontSize(8.5);
  doc.text(
    "Labor, payroll burden, overhead, target profit, supervision, tools, equipment, and supplies.",
    PAGE_WIDTH / 2,
    y + 128,
    { align: "center", maxWidth: CONTENT_WIDTH - 50 },
  );

  y += 174;
  addSimpleTable({
    body: [
      ["Direct Labor Cost", formatCurrency(model.cost.monthlyDirectLaborCost)],
      ["Loaded Labor Cost", formatCurrency(model.cost.monthlyLoadedLaborCost)],
      ["Monthly Overhead Cost", formatCurrency(model.cost.monthlyOverheadCost)],
      ["Monthly Cost", formatCurrency(model.cost.monthlyCost)],
      ["Monthly Profit", formatCurrency(model.cost.grossMonthlyProfit)],
      ["Recommended Monthly Contract Price", formatCurrency(model.cost.recommendedMonthlyContract)],
      ["Annual Contract Price", formatCurrency(model.cost.recommendedAnnualContract)],
      ["Default Service Frequency", model.defaultFrequency],
      ["Currency", "US Dollars"],
    ],
    doc: doc as AutoTableDocument,
    head: ["Pricing Element", "Amount / Detail"],
    startY: y,
  });
}

function addTenYearSchedule(doc: jsPDF, estimate: EstimateDraft) {
  const model = getProposalModel(estimate);
  let y = addSectionPage(doc, "Section 11 - Continued", "Ten-Year Price Schedule");
  const escalation = 0.03;
  const rows: Array<Array<string | number>> = [];
  let annual = model.cost.recommendedAnnualContract;
  let total = 0;

  for (let year = 1; year <= 10; year += 1) {
    if (year > 1) {
      annual *= 1 + escalation;
    }

    total += annual;
    rows.push([
      `Year ${year}`,
      formatCurrency(annual),
      formatCurrency(annual / 12),
    ]);
  }

  rows.push(["10-Year Total", formatCurrency(total), "-"]);

  y = drawWrappedText({
    doc,
    lineHeight: 16,
    text:
      "The schedule below applies a flat 3% annual escalation to the recommended annual contract value. Figures are rounded to the nearest dollar.",
    y,
  }) + 20;

  addSimpleTable({
    body: rows,
    doc: doc as AutoTableDocument,
    head: ["Contract Year", "Annual Firm-Fixed Price", "Monthly Equivalent"],
    startY: y,
  });

  addCallout(
    doc,
    "About this schedule",
    "This schedule is a planning tool. Final renewal, escalation, and billing terms should be confirmed in the executed agreement.",
    MARGIN_X,
    ((doc as AutoTableDocument).lastAutoTable?.finalY ?? y) + 24,
    CONTENT_WIDTH,
    86,
  );
}

function addTerms(doc: jsPDF, estimate: EstimateDraft) {
  let y = addSectionPage(doc, "Section 12", "Service Agreement Terms");

  y = drawWrappedText({
    doc,
    lineHeight: 16,
    text:
      "The following points clarify the proposed service relationship. Final terms should be confirmed in the definitive agreement between the parties.",
    y,
  }) + 20;

  y = addSimpleTable({
    body: [
      ["Commencement", "To be confirmed by client and service provider."],
      ["Facility", cleanText(estimate.facility.address)],
      ["Authorized Representative", "To be completed at signing."],
    ],
    doc: doc as AutoTableDocument,
    head: ["Term", "Detail"],
    startY: y,
  });

  const terms = [
    "Service provider will provide labor, supervision, materials, and equipment necessary to complete the approved scope.",
    "Required insurance, site access, background screening, and safety requirements will be confirmed before service begins.",
    "Pricing is firm and fixed for the approved scope unless facility size, service frequency, room mix, or required tasks change materially.",
    "Additional work outside the approved scope will be quoted and approved in writing before execution.",
    "Agreement term, renewal, termination notice, invoicing terms, and due dates will be finalized in the executed contract.",
  ];

  setRgb(doc, "setTextColor", INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  let nextY = y + 12;
  terms.forEach((term, index) => {
    doc.text(`${index + 1}.`, MARGIN_X, nextY);
    nextY = drawWrappedText({
      doc,
      lineHeight: 15,
      text: term,
      width: CONTENT_WIDTH - 28,
      x: MARGIN_X + 26,
      y: nextY,
    }) + 10;
  });
}

function addSignaturePage(doc: jsPDF, estimate: EstimateDraft) {
  let y = addSectionPage(doc, "Section 13", "Signature Page");
  const providerName = "Service Provider";
  const clientName = cleanText(estimate.facility.clientName);

  y = drawWrappedText({
    doc,
    lineHeight: 16,
    text: `This proposal may be accepted by authorized representatives of both parties below. The agreement covers janitorial and sanitation services at ${cleanText(estimate.facility.address)} as described in the scope, staffing, and pricing sections.`,
    y,
  }) + 48;

  const colW = 220;
  [
    [providerName, MARGIN_X],
    [clientName, MARGIN_X + 260],
  ].forEach(([name, xValue]) => {
    const x = Number(xValue);
    setRgb(doc, "setTextColor", TEAL);
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text(String(name), x, y);
    setRgb(doc, "setDrawColor", INK);
    doc.setLineWidth(0.5);
    doc.line(x, y + 36, x + colW, y + 36);
    doc.line(x, y + 74, x + colW, y + 74);
    doc.line(x, y + 112, x + colW, y + 112);
    setRgb(doc, "setTextColor", MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("BY (SIGNATURE)", x, y + 50);
    doc.text("NAME & TITLE", x, y + 88);
    doc.text("DATE", x, y + 126);
  });

  addCallout(
    doc,
    "Thank you",
    "We would be honored to support this facility with a clean, reliable, and well-managed janitorial program.",
    MARGIN_X,
    y + 174,
    CONTENT_WIDTH,
    80,
  );
}

function addFooters(doc: jsPDF, estimate: EstimateDraft) {
  const pageCount = doc.getNumberOfPages();
  const footerText = `${reportTitle(estimate)} - Sanitation Services Proposal`;

  for (let page = 2; page <= pageCount; page += 1) {
    doc.setPage(page);
    setRgb(doc, "setDrawColor", BORDER);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_X, PAGE_HEIGHT - 52, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 52);
    setRgb(doc, "setTextColor", MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("Walkthrough Estimator", MARGIN_X, PAGE_HEIGHT - 36);
    doc.text(footerText, PAGE_WIDTH / 2, PAGE_HEIGHT - 36, {
      align: "center",
      maxWidth: 260,
    });
    doc.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 36, {
      align: "right",
    });
  }
}

function createProposalDocument(estimate: EstimateDraft) {
  const doc = new jsPDF({ format: "letter", unit: "pt" });

  addCover(doc, estimate);
  addTableOfContents(doc);
  addLetter(doc, estimate);
  addExecutiveOverview(doc, estimate);
  addAboutProvider(doc);
  addWhyProgram(doc);
  addFacilityScope(doc, estimate);
  addEnvironment(doc, estimate);
  addScope(doc, estimate);
  addScheduleStaffing(doc, estimate);
  addWalkthroughBreakdown(doc, estimate);
  addFinancials(doc, estimate);
  addPricing(doc, estimate);
  addTenYearSchedule(doc, estimate);
  addTerms(doc, estimate);
  addSignaturePage(doc, estimate);
  addFooters(doc, estimate);

  return doc;
}

export function getProposalPdfFileName(estimate: EstimateDraft) {
  return `${fileBaseName(estimate) || "walkthrough"}-proposal.pdf`;
}

export function createProposalPdfBlob(estimate: EstimateDraft) {
  return createProposalDocument(estimate).output("blob");
}

export function exportProposalPdf(estimate: EstimateDraft) {
  const fileName = getProposalPdfFileName(estimate);
  downloadBlob(createProposalPdfBlob(estimate), fileName);

  return fileName;
}
