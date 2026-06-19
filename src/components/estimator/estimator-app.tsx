"use client";

import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Archive,
  Building2,
  Camera,
  ClipboardList,
  Clock3,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Layers3,
  LogOut,
  Mic,
  Pencil,
  Plus,
  Play,
  QrCode,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteCloudWalkthrough,
  downloadCloudWalkthroughProposal,
  downloadCloudWalkthroughPdf,
  listCloudWalkthroughs,
  saveCloudWalkthroughProposal,
  saveCloudWalkthrough,
} from "@/lib/cloud-walkthroughs";
import {
  buildEstimateDraft,
  createRoomEntry,
  facilityLabel,
  formatCurrency,
  formatNumber,
  getBuildingSummaries,
  getEntriesForBuilding,
  getEntriesForFloor,
  getEntryBuildingId,
  getEntryFloor,
  getCostSummary,
  getFloorNumbers,
  getFloorSummaries,
  getRoomBreakdown,
  getStaffingTotals,
  getTotals,
  normalizeBuildingId,
  normalizeBuildings,
  normalizeCleaningFrequency,
  normalizeFloorNumber,
  updateRoomEntry,
} from "@/lib/calculations";
import {
  DEFAULT_BUILDING_ID,
  DEFAULT_BUILDINGS,
  DEFAULT_FACILITY,
  DEFAULT_PRICING,
  DEFAULT_PROPOSAL_CONTENT,
  FACILITY_TYPES,
  FREQUENCY_OPTIONS,
  MINUTE_OPTIONS,
  ROOM_TYPES,
} from "@/lib/constants";
import {
  createPdfEstimateBlob,
  exportCsvEstimate,
  exportExcelEstimate,
  exportPdfEstimate,
  getPdfEstimateFileName,
} from "@/lib/exports";
import {
  createProposalPdfBlob,
  exportProposalPdf,
  getProposalPdfFileName,
} from "@/lib/proposals";
import {
  clearActiveEstimate,
  deleteSavedEstimate as deleteSavedEstimateRecord,
  listSavedEstimates,
  loadActiveEstimate,
  saveActiveEstimate,
  saveEstimateSnapshot,
} from "@/lib/storage";
import type {
  BuildingInfo,
  CleaningFrequency,
  EstimateDraft,
  FacilityInfo,
  FacilityType,
  OrganizationSummary,
  PricingInputs,
  ProposalContent,
  RoomEntry,
  RoomType,
} from "@/lib/types";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

type AppStep = "dashboard" | "facility" | "walkthrough";
type HistoryMode = "cloud" | "local";

type EstimatorAppProps = {
  organization: OrganizationSummary;
  organizations: OrganizationSummary[];
  userEmail: string;
  userId: string;
  onChangeOrganization: (organizationId: string) => void;
  onSignOut: () => void;
};

type EditingEntry = {
  id: string;
  buildingId: string;
  roomType: RoomType;
  minutes: number;
  floorNumber: number;
  cleaningFrequency?: CleaningFrequency;
};

const roomAccentClasses = [
  "bg-[#42d77d]",
  "bg-[#38bdf8]",
  "bg-[#fbbf24]",
  "bg-[#fb7185]",
  "bg-[#a3e635]",
];

function normalizeProposalContent(content?: ProposalContent): ProposalContent {
  return {
    aboutServiceProvider:
      content?.aboutServiceProvider?.trim() ||
      DEFAULT_PROPOSAL_CONTENT.aboutServiceProvider,
    executiveOverview:
      content?.executiveOverview?.trim() ||
      DEFAULT_PROPOSAL_CONTENT.executiveOverview,
    letterOfIntroduction:
      content?.letterOfIntroduction?.trim() ||
      DEFAULT_PROPOSAL_CONTENT.letterOfIntroduction,
  };
}

function normalizeEntries(entries: RoomEntry[]) {
  return entries.map((entry) => ({
    ...entry,
    buildingId: normalizeBuildingId(entry.buildingId),
    floorNumber: normalizeFloorNumber(entry.floorNumber),
  }));
}

function createBuildingId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `building-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDefaultBuildings(numberOfFloors = 1) {
  return normalizeBuildings(
    [
      {
        ...DEFAULT_BUILDINGS[0],
        numberOfFloors,
      },
    ],
    numberOfFloors,
  );
}

export function EstimatorApp({
  organization,
  organizations,
  userEmail,
  userId,
  onChangeOrganization,
  onSignOut,
}: EstimatorAppProps) {
  const [step, setStep] = useState<AppStep>("dashboard");
  const [facility, setFacility] = useState<FacilityInfo>({ ...DEFAULT_FACILITY });
  const [buildings, setBuildings] = useState<BuildingInfo[]>(
    getDefaultBuildings(DEFAULT_FACILITY.numberOfFloors),
  );
  const [entries, setEntries] = useState<RoomEntry[]>([]);
  const [walkthroughNotes, setWalkthroughNotes] = useState("");
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType>("Classroom");
  const [currentBuildingId, setCurrentBuildingId] =
    useState(DEFAULT_BUILDING_ID);
  const [currentFloor, setCurrentFloor] = useState(1);
  const [cleaningFrequency, setCleaningFrequency] =
    useState<CleaningFrequency>("5 days/week");
  const [pricing, setPricing] = useState<PricingInputs>({ ...DEFAULT_PRICING });
  const [proposalContent, setProposalContent] = useState<ProposalContent>(() =>
    normalizeProposalContent(organization.proposalContent),
  );
  const [proposalContentStatus, setProposalContentStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [savedEstimates, setSavedEstimates] = useState<EstimateDraft[]>([]);
  const [historyMode, setHistoryMode] = useState<HistoryMode>("local");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"loading" | "saving" | "saved">(
    "loading",
  );
  const [exportStatus, setExportStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [historyStatus, setHistoryStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const localStorageScope = useMemo(
    () => `${userId}:${organization.id}`,
    [organization.id, userId],
  );

  const totals = useMemo(() => getTotals(entries), [entries]);
  const activeBuilding = useMemo(
    () =>
      buildings.find((building) => building.id === currentBuildingId) ??
      buildings[0] ??
      getDefaultBuildings(facility.numberOfFloors)[0],
    [buildings, currentBuildingId, facility.numberOfFloors],
  );
  const activeBuildingEntries = useMemo(
    () => getEntriesForBuilding(entries, activeBuilding.id),
    [activeBuilding.id, entries],
  );
  const activeBuildingTotals = useMemo(
    () => getTotals(activeBuildingEntries),
    [activeBuildingEntries],
  );
  const floorNumbers = useMemo(
    () =>
      Array.from(
        new Set([
          ...getFloorNumbers(
            activeBuilding.numberOfFloors,
            entries,
            activeBuilding.id,
          ),
          currentFloor,
        ]),
      ).sort((a, b) => a - b),
    [activeBuilding.id, activeBuilding.numberOfFloors, currentFloor, entries],
  );
  const currentFloorEntries = useMemo(
    () => getEntriesForFloor(entries, activeBuilding.id, currentFloor),
    [activeBuilding.id, currentFloor, entries],
  );
  const currentFloorTotals = useMemo(
    () => getTotals(currentFloorEntries),
    [currentFloorEntries],
  );
  const breakdown = useMemo(
    () => getRoomBreakdown(entries, cleaningFrequency),
    [cleaningFrequency, entries],
  );
  const staffing = useMemo(
    () => getStaffingTotals(entries, cleaningFrequency),
    [cleaningFrequency, entries],
  );
  const costSummary = useMemo(
    () => getCostSummary(staffing, pricing),
    [pricing, staffing],
  );
  const floorSummaries = useMemo(
    () =>
      getFloorSummaries({
        entries,
        building: activeBuilding,
        cleaningFrequency,
        pricing,
      }),
    [activeBuilding, cleaningFrequency, entries, pricing],
  );
  const buildingSummaries = useMemo(
    () =>
      getBuildingSummaries({
        entries,
        buildings,
        cleaningFrequency,
        pricing,
      }),
    [buildings, cleaningFrequency, entries, pricing],
  );
  const estimateDraft = useMemo(
    () =>
      buildEstimateDraft({
        facility,
        buildings,
        entries,
        walkthroughNotes,
        selectedRoomType,
        currentBuildingId: activeBuilding.id,
        currentFloor,
        cleaningFrequency,
        pricing,
      }),
    [
      activeBuilding.id,
      buildings,
      cleaningFrequency,
      currentFloor,
      entries,
      facility,
      pricing,
      selectedRoomType,
      walkthroughNotes,
    ],
  );

  useEffect(() => {
    let mounted = true;

    async function restoreDraft() {
      const [savedDraft, savedHistory] = await Promise.all([
        loadActiveEstimate(localStorageScope),
        listSavedEstimates(localStorageScope),
      ]);

      if (!mounted) {
        return;
      }

      if (savedDraft) {
        const nextFacility = { ...DEFAULT_FACILITY, ...savedDraft.facility };
        const nextBuildings = normalizeBuildings(
          savedDraft.buildings,
          nextFacility.numberOfFloors,
        );
        const nextBuildingId = normalizeBuildingId(
          savedDraft.currentBuildingId ?? nextBuildings[0]?.id,
        );

        setFacility(nextFacility);
        setBuildings(nextBuildings);
        setEntries(normalizeEntries(savedDraft.entries ?? []));
        setWalkthroughNotes(savedDraft.walkthroughNotes ?? "");
        setSelectedRoomType(savedDraft.selectedRoomType ?? "Classroom");
        setCurrentBuildingId(
          nextBuildings.some((building) => building.id === nextBuildingId)
            ? nextBuildingId
            : nextBuildings[0]?.id ?? DEFAULT_BUILDING_ID,
        );
        setCurrentFloor(normalizeFloorNumber(savedDraft.currentFloor));
        setCleaningFrequency(
          normalizeCleaningFrequency(savedDraft.cleaningFrequency),
        );
        setPricing({ ...DEFAULT_PRICING, ...savedDraft.pricing });
      }

      try {
        const cloudHistory = await listCloudWalkthroughs(organization.id);
        setSavedEstimates(cloudHistory);
        setHistoryMode("cloud");
        setHistoryStatus({
          tone: "success",
          message: `Cloud history connected for ${organization.name}.`,
        });
      } catch {
        setSavedEstimates(savedHistory);
        setHistoryMode("local");
        setHistoryStatus({
          tone: "error",
          message:
            "Using local history until Supabase Auth, RLS, and storage are ready.",
        });
      }
      setDraftLoaded(true);
      setSaveStatus("saved");
    }

    restoreDraft();

    return () => {
      mounted = false;
    };
  }, [localStorageScope, organization.id, organization.name]);

  useEffect(() => {
    if (!draftLoaded) {
      return;
    }

    const handle = window.setTimeout(() => {
      setSaveStatus("saving");
      saveActiveEstimate(estimateDraft, localStorageScope)
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("saved"));
    }, 180);

    return () => window.clearTimeout(handle);
  }, [draftLoaded, estimateDraft, localStorageScope]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [entries.length]);

  function updateFacility<K extends keyof FacilityInfo>(
    field: K,
    value: FacilityInfo[K],
  ) {
    setFacility((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updatePricing<K extends keyof PricingInputs>(
    field: K,
    value: number,
  ) {
    setPricing((current) => ({
      ...current,
      [field]: Number.isFinite(value) ? value : 0,
    }));
  }

  function updateProposalContent<K extends keyof ProposalContent>(
    field: K,
    value: ProposalContent[K],
  ) {
    setProposalContent((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveProposalContent() {
    try {
      setProposalContentStatus(null);

      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase
        .from("organizations")
        .update({
          proposal_about_service_provider:
            proposalContent.aboutServiceProvider.trim(),
          proposal_executive_overview: proposalContent.executiveOverview.trim(),
          proposal_letter_of_introduction:
            proposalContent.letterOfIntroduction.trim(),
        })
        .eq("id", organization.id);

      if (error) {
        throw error;
      }

      setProposalContentStatus({
        tone: "success",
        message: "Proposal content saved for this organization.",
      });
    } catch (error) {
      console.error(error);
      setProposalContentStatus({
        tone: "error",
        message:
          "Could not save proposal content. Make sure your Supabase schema is updated and your account can edit this organization.",
      });
    }
  }

  function addEntry(minutes: number, quantity = 1) {
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return;
    }

    const safeQuantity = Math.min(
      999,
      Math.max(1, Math.round(Number.isFinite(quantity) ? quantity : 1)),
    );

    setEntries((currentEntries) => {
      const nextEntries = [...currentEntries];

      for (let index = 0; index < safeQuantity; index += 1) {
        nextEntries.push(
          createRoomEntry(
            nextEntries,
            selectedRoomType,
            Math.round(minutes),
            activeBuilding.id,
            currentFloor,
          ),
        );
      }

      return nextEntries;
    });
  }

  function deleteEntry(id: string) {
    setEntries((currentEntries) =>
      currentEntries.filter((entry) => entry.id !== id),
    );
    setEditingEntry((current) => (current?.id === id ? null : current));
  }

  function saveEntryEdit() {
    if (!editingEntry) {
      return;
    }

    setEntries((currentEntries) =>
      updateRoomEntry(currentEntries, editingEntry.id, {
        roomType: editingEntry.roomType,
        buildingId: editingEntry.buildingId,
        minutes: editingEntry.minutes,
        floorNumber: editingEntry.floorNumber,
        cleaningFrequency: editingEntry.cleaningFrequency,
      }),
    );
    setEditingEntry(null);
  }

  async function startNewEstimate() {
    setFacility({ ...DEFAULT_FACILITY });
    setBuildings(getDefaultBuildings(DEFAULT_FACILITY.numberOfFloors));
    setEntries([]);
    setWalkthroughNotes("");
    setSelectedRoomType("Classroom");
    setCurrentBuildingId(DEFAULT_BUILDING_ID);
    setCurrentFloor(1);
    setCleaningFrequency("5 days/week");
    setPricing({ ...DEFAULT_PRICING });
    setEditingEntry(null);
    setStep("facility");
    await clearActiveEstimate(localStorageScope);
    setSaveStatus("saved");
  }

  function addFloor() {
    const nextFloor = normalizeFloorNumber(activeBuilding.numberOfFloors) + 1;
    setBuildings((currentBuildings) =>
      currentBuildings.map((building) =>
        building.id === activeBuilding.id
          ? { ...building, numberOfFloors: nextFloor }
          : building,
      ),
    );
    setCurrentFloor(nextFloor);
  }

  function addBuilding() {
    const buildingNumber = buildings.length + 1;
    const nextBuilding: BuildingInfo = {
      id: createBuildingId(),
      name: `Building ${buildingNumber}`,
      numberOfFloors: 1,
    };

    setBuildings((currentBuildings) => [...currentBuildings, nextBuilding]);
    setCurrentBuildingId(nextBuilding.id);
    setCurrentFloor(1);
    setEditingEntry(null);
  }

  function selectBuilding(buildingId: string) {
    setCurrentBuildingId(buildingId);
    setCurrentFloor(1);
    setEditingEntry(null);
  }

  function renameBuilding(buildingId: string, name: string) {
    setBuildings((currentBuildings) =>
      currentBuildings.map((building) =>
        building.id === buildingId ? { ...building, name } : building,
      ),
    );
  }

  function startWalkthrough() {
    if (entries.length === 0 && buildings.length === 1) {
      const nextBuildings = getDefaultBuildings(facility.numberOfFloors);
      setBuildings(nextBuildings);
      setCurrentBuildingId(nextBuildings[0]?.id ?? DEFAULT_BUILDING_ID);
      setCurrentFloor(1);
    }

    setStep("walkthrough");
  }

  async function refreshDashboard() {
    try {
      await refreshSavedHistory();
      setHistoryStatus({
        tone: "success",
        message: `Dashboard refreshed from ${
          historyMode === "cloud" ? "cloud storage" : "local history"
        }.`,
      });
    } catch {
      setHistoryStatus({
        tone: "error",
        message: "Could not refresh saved walkthroughs.",
      });
    }
  }

  async function refreshSavedHistory() {
    if (historyMode === "cloud") {
      setSavedEstimates(await listCloudWalkthroughs(organization.id));
      return;
    }

    setSavedEstimates(await listSavedEstimates(localStorageScope));
  }

  async function saveWalkthroughSnapshot() {
    try {
      const savedEstimate =
        historyMode === "cloud"
          ? await saveCloudWalkthrough({
              organizationId: organization.id,
              estimate: estimateDraft,
              pdfBlob: createPdfEstimateBlob(estimateDraft),
              pdfFileName: getPdfEstimateFileName(estimateDraft),
            })
          : await saveEstimateSnapshot(estimateDraft, localStorageScope);
      await refreshSavedHistory();
      setHistoryStatus({
        tone: "success",
        message: `Saved ${
          historyMode === "cloud" ? "to cloud" : "locally"
        }: ${facilityLabel(savedEstimate.facility)}`,
      });
    } catch (error) {
      console.error(error);
      setHistoryStatus({
        tone: "error",
        message: "Could not save this walkthrough.",
      });
    }
  }

  async function reopenSavedWalkthrough(estimate: EstimateDraft) {
    const nextBuildings = normalizeBuildings(
      estimate.buildings,
      estimate.facility.numberOfFloors,
    );
    const nextBuildingId = normalizeBuildingId(
      estimate.currentBuildingId ?? nextBuildings[0]?.id,
    );
    const normalizedEstimate: EstimateDraft = {
      ...estimate,
      buildings: nextBuildings,
      entries: normalizeEntries(estimate.entries),
      currentBuildingId: nextBuildings.some(
        (building) => building.id === nextBuildingId,
      )
        ? nextBuildingId
        : nextBuildings[0]?.id ?? DEFAULT_BUILDING_ID,
      currentFloor: normalizeFloorNumber(estimate.currentFloor),
      cleaningFrequency: normalizeCleaningFrequency(estimate.cleaningFrequency),
    };

    setFacility({ ...DEFAULT_FACILITY, ...normalizedEstimate.facility });
    setBuildings(normalizedEstimate.buildings);
    setEntries(normalizedEstimate.entries);
    setWalkthroughNotes(normalizedEstimate.walkthroughNotes ?? "");
    setSelectedRoomType(normalizedEstimate.selectedRoomType ?? "Classroom");
    setCurrentBuildingId(normalizedEstimate.currentBuildingId);
    setCurrentFloor(normalizedEstimate.currentFloor);
    setCleaningFrequency(normalizedEstimate.cleaningFrequency);
    setPricing({ ...DEFAULT_PRICING, ...normalizedEstimate.pricing });
    setEditingEntry(null);
    setStep("walkthrough");
    await saveActiveEstimate(
      {
        ...normalizedEstimate,
        id: estimateDraft.id,
        savedAt: undefined,
        updatedAt: new Date().toISOString(),
      },
      localStorageScope,
    );
    setHistoryStatus({
      tone: "success",
      message: `Reopened ${facilityLabel(normalizedEstimate.facility)}`,
    });
  }

  async function deleteWalkthroughSnapshot(id: string) {
    if (historyMode === "cloud") {
      await deleteCloudWalkthrough(id);
    } else {
      await deleteSavedEstimateRecord(id, localStorageScope);
    }

    await refreshSavedHistory();
    setHistoryStatus({
      tone: "success",
      message: "Saved walkthrough deleted.",
    });
  }

  function runExport(exporter: () => string, label: string) {
    try {
      const fileName = exporter();
      setExportStatus({
        tone: "success",
        message: `${label} generated: ${fileName}`,
      });
    } catch (error) {
      console.error(error);
      setExportStatus({
        tone: "error",
        message: `${label} failed. Try again after adding at least one room, or check browser download permissions.`,
      });
    }
  }

  async function openSavedProposal(estimate: EstimateDraft) {
    try {
      if (historyMode === "cloud") {
        if (!estimate.proposalPdfPath) {
          const fileName = getProposalPdfFileName(estimate);

          await saveCloudWalkthroughProposal({
            id: estimate.id,
            proposalBlob: createProposalPdfBlob(estimate, proposalContent),
            proposalFileName: fileName,
          });
          setHistoryStatus({
            tone: "success",
            message: `Proposal generated and saved: ${fileName}`,
          });
        }

        await downloadCloudWalkthroughProposal(estimate.id);
        await refreshSavedHistory();
        return;
      }

      runExport(
        () => exportProposalPdf(estimate, proposalContent),
        "Proposal PDF",
      );
    } catch (error) {
      console.error(error);
      setHistoryStatus({
        tone: "error",
        message:
          "Could not generate or download the proposal PDF. Make sure the Supabase schema has been updated.",
      });
    }
  }

  if (step === "facility") {
    return (
      <FacilityScreen
        facility={facility}
        organization={organization}
        organizations={organizations}
        saveStatus={saveStatus}
        userEmail={userEmail}
        onDashboard={() => setStep("dashboard")}
        onChangeOrganization={onChangeOrganization}
        onSignOut={onSignOut}
        onStart={startWalkthrough}
        onUpdateFacility={updateFacility}
      />
    );
  }

  if (step === "dashboard") {
    return (
      <SavedWalkthroughDashboard
        historyMode={historyMode}
        organization={organization}
        organizations={organizations}
        savedEstimates={savedEstimates}
        status={historyStatus}
        proposalContent={proposalContent}
        proposalContentStatus={proposalContentStatus}
        userEmail={userEmail}
        onChangeOrganization={onChangeOrganization}
        onDelete={deleteWalkthroughSnapshot}
        onChangeProposalContent={updateProposalContent}
        onGenerateProposal={openSavedProposal}
        onExportPdf={(estimate) => {
          if (historyMode === "cloud") {
            downloadCloudWalkthroughPdf(estimate.id).catch(() =>
              runExport(() => exportPdfEstimate(estimate), "Saved PDF export"),
            );
            return;
          }

          runExport(() => exportPdfEstimate(estimate), "Saved PDF export");
        }}
        onNewEstimate={startNewEstimate}
        onOpen={reopenSavedWalkthrough}
        onSaveProposalContent={saveProposalContent}
        onRefresh={refreshDashboard}
        onSignOut={onSignOut}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-[#07110f] text-foreground">
      <RunningTotalsBar
        totals={totals}
        breakdown={breakdown}
        facilityName={facilityLabel(facility)}
        organization={organization}
        saveStatus={saveStatus}
        userEmail={userEmail}
        onBack={() => setStep("facility")}
        onDashboard={() => setStep("dashboard")}
        onNewEstimate={startNewEstimate}
        onSignOut={onSignOut}
      />

      <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-3 py-4 sm:px-5 lg:px-6">
        <BuildingWorkflowPanel
          activeBuilding={activeBuilding}
          activeBuildingTotals={activeBuildingTotals}
          buildings={buildings}
          buildingSummaries={buildingSummaries}
          currentFloor={currentFloor}
          currentFloorTotals={currentFloorTotals}
          floorNumbers={floorNumbers}
          floorSummaries={floorSummaries}
          onAddBuilding={addBuilding}
          onAddFloor={addFloor}
          onRenameBuilding={renameBuilding}
          onSelectBuilding={selectBuilding}
          onSelectFloor={setCurrentFloor}
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(310px,0.95fr)_minmax(350px,1fr)_minmax(360px,1.05fr)]">
          <RoomTypeSelector
            selectedRoomType={selectedRoomType}
            onSelect={setSelectedRoomType}
          />

          <MinuteKeyboard
            selectedRoomType={selectedRoomType}
            onAddMinutes={addEntry}
          />

          <RoomLogPanel
            entries={currentFloorEntries}
            editingEntry={editingEntry}
            defaultFrequency={cleaningFrequency}
            activeBuilding={activeBuilding}
            buildings={buildings}
            currentFloor={currentFloor}
            floorNumbers={floorNumbers}
            allEntries={entries}
            logEndRef={logEndRef}
            onStartEdit={(entry) =>
              setEditingEntry({
                id: entry.id,
                buildingId: getEntryBuildingId(entry),
                roomType: entry.roomType,
                minutes: entry.minutes,
                floorNumber: getEntryFloor(entry),
                cleaningFrequency: entry.cleaningFrequency
                  ? normalizeCleaningFrequency(entry.cleaningFrequency)
                  : undefined,
              })
            }
            onCancelEdit={() => setEditingEntry(null)}
            onChangeEdit={setEditingEntry}
            onSaveEdit={saveEntryEdit}
            onDelete={deleteEntry}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid gap-4">
            <ProductivityPanel totals={totals} />
            <StaffingPanel
              cleaningFrequency={cleaningFrequency}
              staffing={staffing}
              onChangeFrequency={setCleaningFrequency}
            />
            <WalkthroughNotesPanel
              notes={walkthroughNotes}
              onChangeNotes={setWalkthroughNotes}
            />
          </div>

          <div className="grid gap-4">
            <DashboardSummary totals={totals} costSummary={costSummary} />
            <CostEstimatorPanel
              pricing={pricing}
              costSummary={costSummary}
              onUpdatePricing={updatePricing}
            />
            <SavedWalkthroughsPanel
              historyMode={historyMode}
              savedEstimates={savedEstimates}
              status={historyStatus}
              onDelete={deleteWalkthroughSnapshot}
              onExportPdf={(estimate) => {
                if (historyMode === "cloud") {
                  downloadCloudWalkthroughPdf(estimate.id).catch(() =>
                    runExport(
                      () => exportPdfEstimate(estimate),
                      "Saved PDF export",
                    ),
                  );
                  return;
                }

                runExport(() => exportPdfEstimate(estimate), "Saved PDF export");
              }}
              onGenerateProposal={openSavedProposal}
              onReopen={reopenSavedWalkthrough}
              onSaveCurrent={saveWalkthroughSnapshot}
            />
            <ExportPanel
              status={exportStatus}
              onProposal={() =>
                runExport(
                  () => exportProposalPdf(estimateDraft, proposalContent),
                  "Proposal PDF",
                )
              }
              onPdf={() =>
                runExport(() => exportPdfEstimate(estimateDraft), "PDF export")
              }
              onExcel={() =>
                runExport(
                  () => exportExcelEstimate(estimateDraft),
                  "Excel export",
                )
              }
              onCsv={() =>
                runExport(() => exportCsvEstimate(estimateDraft), "CSV export")
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function getEstimateDashboardMetrics(estimate: EstimateDraft) {
  const cleaningFrequency = normalizeCleaningFrequency(estimate.cleaningFrequency);
  const totals = getTotals(estimate.entries);
  const staffing = getStaffingTotals(estimate.entries, cleaningFrequency);
  const cost = getCostSummary(staffing, estimate.pricing);
  const buildings = normalizeBuildings(
    estimate.buildings,
    estimate.facility.numberOfFloors,
  );

  return { buildings, cleaningFrequency, cost, staffing, totals };
}

function SavedWalkthroughDashboard({
  historyMode,
  organization,
  organizations,
  savedEstimates,
  status,
  proposalContent,
  proposalContentStatus,
  userEmail,
  onChangeOrganization,
  onChangeProposalContent,
  onDelete,
  onExportPdf,
  onGenerateProposal,
  onNewEstimate,
  onOpen,
  onSaveProposalContent,
  onRefresh,
  onSignOut,
}: {
  historyMode: HistoryMode;
  organization: OrganizationSummary;
  organizations: OrganizationSummary[];
  savedEstimates: EstimateDraft[];
  status: {
    tone: "success" | "error";
    message: string;
  } | null;
  proposalContent: ProposalContent;
  proposalContentStatus: {
    tone: "success" | "error";
    message: string;
  } | null;
  userEmail: string;
  onChangeOrganization: (organizationId: string) => void;
  onChangeProposalContent: <K extends keyof ProposalContent>(
    field: K,
    value: ProposalContent[K],
  ) => void;
  onDelete: (id: string) => void;
  onExportPdf: (estimate: EstimateDraft) => void;
  onGenerateProposal: (estimate: EstimateDraft) => void;
  onNewEstimate: () => void;
  onOpen: (estimate: EstimateDraft) => void;
  onSaveProposalContent: () => void;
  onRefresh: () => void;
  onSignOut: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const filteredEstimates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return savedEstimates;
    }

    return savedEstimates.filter((estimate) => {
      const buildings = normalizeBuildings(
        estimate.buildings,
        estimate.facility.numberOfFloors,
      );
      const searchable = [
        estimate.facility.facilityName,
        estimate.facility.clientName,
        estimate.facility.address,
        estimate.facility.facilityType,
        ...buildings.map((building) => building.name),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [savedEstimates, searchQuery]);
  const dashboardTotals = useMemo(
    () =>
      savedEstimates.reduce(
        (summary, estimate) => {
          const metrics = getEstimateDashboardMetrics(estimate);

          return {
            annualRevenue:
              summary.annualRevenue + metrics.cost.recommendedAnnualContract,
            monthlyRevenue:
              summary.monthlyRevenue + metrics.cost.recommendedMonthlyContract,
            rooms: summary.rooms + metrics.totals.totalRooms,
            walkthroughs: summary.walkthroughs + 1,
          };
        },
        {
          annualRevenue: 0,
          monthlyRevenue: 0,
          rooms: 0,
          walkthroughs: 0,
        },
      ),
    [savedEstimates],
  );

  return (
    <main className="min-h-dvh bg-[#07110f] px-3 py-4 text-foreground sm:px-5 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-[#101816] p-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-[#2f403a] bg-[#0b1311] text-primary">
              <ClipboardList className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold leading-7 text-foreground">
                Saved Walkthrough Dashboard
              </h1>
              <p className="truncate text-sm text-muted-foreground">
                {organization.name} - {userEmail}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <OrganizationControl
              organization={organization}
              organizations={organizations}
              onChangeOrganization={onChangeOrganization}
            />
            <Button variant="secondary" onClick={onRefresh}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button onClick={onNewEstimate}>
              <Plus className="size-4" />
              New Walkthrough
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={onSignOut}
              aria-label="Sign out"
            >
              <LogOut className="size-5" />
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <MetricTile
            icon={Archive}
            label="Saved Walkthroughs"
            value={formatNumber(dashboardTotals.walkthroughs, 0)}
            tone="green"
          />
          <MetricTile
            icon={ClipboardList}
            label="Total Rooms"
            value={formatNumber(dashboardTotals.rooms, 0)}
            tone="sky"
          />
          <MetricTile
            icon={DollarSign}
            label="Monthly Revenue"
            value={formatCurrency(dashboardTotals.monthlyRevenue)}
            tone="green"
          />
          <MetricTile
            icon={DollarSign}
            label="Annual Revenue"
            value={formatCurrency(dashboardTotals.annualRevenue)}
            tone="amber"
          />
        </section>

        <ProposalContentPanel
          content={proposalContent}
          status={proposalContentStatus}
          onChangeContent={onChangeProposalContent}
          onSave={onSaveProposalContent}
        />

        <Card className="bg-[#101816]">
          <CardContent className="grid gap-3 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="Search facility, client, address, type, or building"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
              <Badge
                className={cn(
                  "border-[#31453d] bg-[#0b1311]",
                  historyMode === "cloud" ? "text-primary" : "text-[#fbbf24]",
                )}
              >
                {historyMode === "cloud" ? "Cloud Storage" : "Local Fallback"}
              </Badge>
            </div>

            {status ? (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-sm font-medium",
                  status.tone === "success"
                    ? "border-primary/50 bg-primary/10 text-[#c7f8d9]"
                    : "border-destructive/60 bg-destructive/10 text-[#ffd0d0]",
                )}
              >
                {status.message}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {filteredEstimates.length === 0 ? (
          <section className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-[#344840] bg-[#101816] p-6 text-center">
            <Archive className="size-10 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">
              No saved walkthroughs found
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Start a new walkthrough, add rooms, then use Save Walkthrough to
              add it to this dashboard.
            </p>
            <Button className="mt-4" onClick={onNewEstimate}>
              <Plus className="size-4" />
              New Walkthrough
            </Button>
          </section>
        ) : (
          <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {filteredEstimates.map((estimate) => {
              const metrics = getEstimateDashboardMetrics(estimate);
              const savedAt = estimate.savedAt ?? estimate.updatedAt;

              return (
                <Card key={estimate.id} className="bg-[#101816]">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate">
                          {facilityLabel(estimate.facility)}
                        </CardTitle>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {estimate.facility.clientName || "No client"} -{" "}
                          {estimate.facility.facilityType}
                        </p>
                      </div>
                      <Badge className="shrink-0 border-[#31453d] bg-[#0b1311]">
                        {metrics.buildings.length} buildings
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <SummaryLine
                        label="Rooms"
                        value={formatNumber(metrics.totals.totalRooms, 0)}
                      />
                      <SummaryLine
                        label="Hours"
                        value={formatNumber(metrics.totals.totalHours)}
                      />
                      <SummaryLine
                        label="Monthly Price"
                        value={formatCurrency(
                          metrics.cost.recommendedMonthlyContract,
                        )}
                        emphasis
                      />
                      <SummaryLine
                        label="Annual Price"
                        value={formatCurrency(
                          metrics.cost.recommendedAnnualContract,
                        )}
                      />
                    </div>

                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Address</span>
                        <span className="truncate text-right font-medium">
                          {estimate.facility.address || "Not specified"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Saved</span>
                        <span className="text-right font-medium">
                          {savedAt ? new Date(savedAt).toLocaleDateString() : "Saved"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Frequency</span>
                        <span className="text-right font-medium">
                          {metrics.cleaningFrequency}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Proposal</span>
                        <span className="text-right font-medium">
                          {estimate.proposalGeneratedAt
                            ? "Ready"
                            : "Not generated"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {metrics.buildings.slice(0, 4).map((building) => (
                        <Badge
                          key={building.id}
                          className="border-[#31453d] bg-[#0b1311] text-[#cfe5d8]"
                        >
                          {building.name}
                        </Badge>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" onClick={() => onOpen(estimate)}>
                        <RotateCcw className="size-4" />
                        Open
                      </Button>
                      <Button
                        variant="default"
                        onClick={() => onGenerateProposal(estimate)}
                      >
                        <FileText className="size-4" />
                        Proposal
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => onExportPdf(estimate)}
                      >
                        <FileText className="size-4" />
                        PDF
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => onDelete(estimate.id)}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

function ProposalContentPanel({
  content,
  status,
  onChangeContent,
  onSave,
}: {
  content: ProposalContent;
  status: {
    tone: "success" | "error";
    message: string;
  } | null;
  onChangeContent: <K extends keyof ProposalContent>(
    field: K,
    value: ProposalContent[K],
  ) => void;
  onSave: () => void;
}) {
  return (
    <Card className="bg-[#101816]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Proposal Content</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Saved company language used in every generated proposal.
            </p>
          </div>
          <Button className="h-12" onClick={onSave}>
            <Save className="size-4" />
            Save Content
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <ProposalTextarea
            id="proposal-letter"
            label="Letter of Introduction"
            value={content.letterOfIntroduction}
            onChange={(value) => onChangeContent("letterOfIntroduction", value)}
          />
          <ProposalTextarea
            id="proposal-overview"
            label="Executive Overview"
            value={content.executiveOverview}
            onChange={(value) => onChangeContent("executiveOverview", value)}
          />
          <ProposalTextarea
            id="proposal-about"
            label="About the Service Provider"
            value={content.aboutServiceProvider}
            onChange={(value) => onChangeContent("aboutServiceProvider", value)}
          />
        </div>

        {status ? (
          <div
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium",
              status.tone === "success"
                ? "border-primary/50 bg-primary/10 text-[#c7f8d9]"
                : "border-destructive/60 bg-destructive/10 text-[#ffd0d0]",
            )}
          >
            {status.message}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProposalTextarea({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        className="min-h-44"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function FacilityScreen({
  facility,
  organization,
  organizations,
  saveStatus,
  userEmail,
  onDashboard,
  onChangeOrganization,
  onSignOut,
  onStart,
  onUpdateFacility,
}: {
  facility: FacilityInfo;
  organization: OrganizationSummary;
  organizations: OrganizationSummary[];
  saveStatus: "loading" | "saving" | "saved";
  userEmail: string;
  onDashboard: () => void;
  onChangeOrganization: (organizationId: string) => void;
  onSignOut: () => void;
  onStart: () => void;
  onUpdateFacility: <K extends keyof FacilityInfo>(
    field: K,
    value: FacilityInfo[K],
  ) => void;
}) {
  return (
    <main className="min-h-dvh bg-[#07110f] px-4 py-5 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-5xl flex-col gap-5">
        <AppHeader
          organization={organization}
          organizations={organizations}
          saveStatus={saveStatus}
          userEmail={userEmail}
          onDashboard={onDashboard}
          onChangeOrganization={onChangeOrganization}
          onSignOut={onSignOut}
        />

        <section className="grid flex-1 items-center gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col gap-5 rounded-lg border border-border bg-[#0d1714] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Building2 className="size-6" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold leading-10 text-foreground sm:text-4xl sm:leading-[3rem]">
                  GreenPoint Walkthrough Estimator
                </h1>
                <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
                  Janitorial labor estimating for schools, offices, airports,
                  healthcare, warehouses, government buildings, and industrial
                  facilities.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <CapabilityChip icon={Mic} label="Voice Ready" />
              <CapabilityChip icon={Camera} label="Photo Ready" />
              <CapabilityChip icon={QrCode} label="QR Ready" />
              <CapabilityChip icon={Sparkles} label="AI Ready" />
            </div>
          </div>

          <Card className="border-[#2a3a35] bg-[#101816]">
            <CardHeader>
              <CardTitle>Facility Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="facility-name">Facility Name</Label>
                <Input
                  id="facility-name"
                  value={facility.facilityName}
                  onChange={(event) =>
                    onUpdateFacility("facilityName", event.target.value)
                  }
                  autoComplete="organization"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="client-name">Client Name</Label>
                <Input
                  id="client-name"
                  value={facility.clientName}
                  onChange={(event) =>
                    onUpdateFacility("clientName", event.target.value)
                  }
                  autoComplete="name"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={facility.address}
                  onChange={(event) =>
                    onUpdateFacility("address", event.target.value)
                  }
                  autoComplete="street-address"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="square-footage">Square Footage</Label>
                  <Input
                    id="square-footage"
                    inputMode="numeric"
                    type="number"
                    min={0}
                    value={facility.squareFootage || ""}
                    onChange={(event) =>
                      onUpdateFacility(
                        "squareFootage",
                        Number(event.target.value) || 0,
                      )
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="number-of-floors">Number of Floors</Label>
                  <Input
                    id="number-of-floors"
                    inputMode="numeric"
                    type="number"
                    min={0}
                    value={facility.numberOfFloors || ""}
                    onChange={(event) =>
                      onUpdateFacility(
                        "numberOfFloors",
                        Number(event.target.value) || 0,
                      )
                    }
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Facility Type</Label>
                <Select
                  value={facility.facilityType}
                  onValueChange={(value) =>
                    onUpdateFacility("facilityType", value as FacilityType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FACILITY_TYPES.map((facilityType) => (
                      <SelectItem key={facilityType} value={facilityType}>
                        {facilityType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button className="mt-2 h-14 text-base" size="lg" onClick={onStart}>
                <Play className="size-5" />
                START WALKTHROUGH
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function AppHeader({
  organization,
  organizations,
  saveStatus,
  userEmail,
  onDashboard,
  onChangeOrganization,
  onSignOut,
}: {
  organization: OrganizationSummary;
  organizations: OrganizationSummary[];
  saveStatus: "loading" | "saving" | "saved";
  userEmail: string;
  onDashboard: () => void;
  onChangeOrganization: (organizationId: string) => void;
  onSignOut: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-md border border-[#2f403a] bg-[#101816] text-primary">
          <Building2 className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#dce9df]">GreenPoint</p>
          <p className="text-xs text-muted-foreground">Walkthrough Estimator</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <OrganizationControl
          organization={organization}
          organizations={organizations}
          onChangeOrganization={onChangeOrganization}
        />
        <Button variant="secondary" onClick={onDashboard}>
          <Archive className="size-4" />
          Dashboard
        </Button>
        <Badge className="gap-2 border-[#31453d] bg-[#101816] text-[#cfe5d8]">
          <Save className="size-4 text-primary" />
          {saveStatus === "loading"
            ? "Loading local database"
            : saveStatus === "saving"
              ? "Saving"
              : "Saved locally"}
        </Badge>
        <Button variant="secondary" onClick={onSignOut}>
          <LogOut className="size-4" />
          <span className="hidden sm:inline">{userEmail || "Sign Out"}</span>
          <span className="sm:hidden">Exit</span>
        </Button>
      </div>
    </header>
  );
}

function OrganizationControl({
  organization,
  organizations,
  onChangeOrganization,
}: {
  organization: OrganizationSummary;
  organizations: OrganizationSummary[];
  onChangeOrganization: (organizationId: string) => void;
}) {
  if (organizations.length <= 1) {
    return (
      <Badge className="gap-2 border-[#31453d] bg-[#101816] text-[#cfe5d8]">
        <Building2 className="size-4 text-primary" />
        {organization.name}
      </Badge>
    );
  }

  return (
    <div className="min-w-44">
      <Select value={organization.id} onValueChange={onChangeOrganization}>
        <SelectTrigger className="h-11 bg-[#101816] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {organizations.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CapabilityChip({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-[#0a1210] px-3 text-sm font-medium text-[#d6e3da]">
      <Icon className="size-4 text-primary" />
      {label}
    </div>
  );
}

function RunningTotalsBar({
  totals,
  breakdown,
  facilityName,
  organization,
  saveStatus,
  userEmail,
  onBack,
  onDashboard,
  onNewEstimate,
  onSignOut,
}: {
  totals: ReturnType<typeof getTotals>;
  breakdown: ReturnType<typeof getRoomBreakdown>;
  facilityName: string;
  organization: OrganizationSummary;
  saveStatus: "loading" | "saving" | "saved";
  userEmail: string;
  onBack: () => void;
  onDashboard: () => void;
  onNewEstimate: () => void;
  onSignOut: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[#07110f]/95 px-3 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              className="shrink-0"
              variant="secondary"
              size="icon"
              onClick={onBack}
              aria-label="Facility information"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">
                {facilityName}
              </p>
              <p className="text-xs text-muted-foreground">
                {organization.name} -{" "}
                {saveStatus === "saving" ? "Saving" : "Saved to local database"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="hidden border-[#31453d] bg-[#101816] text-[#cfe5d8] sm:inline-flex">
              {userEmail}
            </Badge>
            <Button variant="secondary" onClick={onDashboard}>
              <Archive className="size-4" />
              Dashboard
            </Button>
            <Button variant="outline" onClick={onNewEstimate}>
              <X className="size-4" />
              New Estimate
            </Button>
            <Button variant="secondary" size="icon" onClick={onSignOut} aria-label="Sign out">
              <LogOut className="size-5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <MetricTile
            icon={ClipboardList}
            label="Total Rooms"
            value={formatNumber(totals.totalRooms, 0)}
            tone="green"
          />
          <MetricTile
            icon={Clock3}
            label="Total Minutes"
            value={formatNumber(totals.totalMinutes, 0)}
            tone="sky"
          />
          <MetricTile
            icon={Layers3}
            label="Total Hours"
            value={formatNumber(totals.totalHours)}
            tone="amber"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {breakdown.length ? (
            breakdown.map((row) => (
              <Badge
                key={row.roomType}
                className="shrink-0 border-[#2f403a] bg-[#101816] text-[#d9e7de]"
              >
                {row.roomType}: {row.count}
              </Badge>
            ))
          ) : (
            <Badge className="border-[#2f403a] bg-[#101816] text-[#a9bbb3]">
              Total Minutes: 0
            </Badge>
          )}
        </div>
      </div>
    </header>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: "green" | "sky" | "amber" | "rose";
}) {
  const toneClass = {
    green: "text-[#42d77d] bg-[#42d77d]/10",
    sky: "text-[#38bdf8] bg-[#38bdf8]/10",
    amber: "text-[#fbbf24] bg-[#fbbf24]/10",
    rose: "text-[#fb7185] bg-[#fb7185]/10",
  }[tone];

  return (
    <div className="min-h-[74px] rounded-md border border-border bg-[#101816] p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn("flex size-7 items-center justify-center rounded-md", toneClass)}>
          <Icon className="size-4" />
        </span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold leading-8 text-foreground">
        {value}
      </div>
    </div>
  );
}

function RoomTypeSelector({
  selectedRoomType,
  onSelect,
}: {
  selectedRoomType: RoomType;
  onSelect: (roomType: RoomType) => void;
}) {
  return (
    <Card className="bg-[#101816]">
      <CardHeader>
        <CardTitle>Room Type Selector</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
          {ROOM_TYPES.map((roomType, index) => {
            const selected = selectedRoomType === roomType;

            return (
              <button
                key={roomType}
                type="button"
                onClick={() => onSelect(roomType)}
                className={cn(
                  "flex min-h-14 items-center gap-2 rounded-md border px-3 text-left text-sm font-semibold leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_10px_30px_rgba(66,215,125,0.22)]"
                    : "border-border bg-[#0b1311] text-[#dce6df] hover:border-[#3a5048] hover:bg-[#13201c]",
                )}
              >
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    selected
                      ? "bg-[#052012]"
                      : roomAccentClasses[index % roomAccentClasses.length],
                  )}
                />
                <span>{roomType}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function MinuteKeyboard({
  selectedRoomType,
  onAddMinutes,
}: {
  selectedRoomType: RoomType;
  onAddMinutes: (minutes: number, quantity?: number) => void;
}) {
  const [customMinutes, setCustomMinutes] = useState("");
  const [quantity, setQuantity] = useState("");

  function getQuantity() {
    const parsedQuantity = Number(quantity);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      return 1;
    }

    return Math.min(999, Math.max(1, Math.round(parsedQuantity)));
  }

  function addMinutes(minutes: number) {
    onAddMinutes(minutes, getQuantity());
    setQuantity("");
  }

  function submitCustomMinutes() {
    const minutes = Number(customMinutes);

    if (!Number.isFinite(minutes) || minutes <= 0) {
      return;
    }

    addMinutes(minutes);
    setCustomMinutes("");
  }

  return (
    <Card className="bg-[#101816]">
      <CardHeader>
        <CardTitle>Minute Keyboard</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="rounded-md border border-[#31453d] bg-[#0b1311] p-4">
          <p className="text-xs text-muted-foreground">Selected Room Type</p>
          <p className="mt-1 text-2xl font-semibold leading-8 text-primary">
            {selectedRoomType}
          </p>
        </div>

        <div className="grid gap-2 rounded-md border border-[#31453d] bg-[#0b1311] p-3">
          <Label htmlFor="room-quantity">Quantity</Label>
          <Input
            id="room-quantity"
            inputMode="numeric"
            max={999}
            min={1}
            placeholder="1"
            type="number"
            value={quantity}
            onChange={(event) =>
              setQuantity(event.target.value.replace(/\D/g, "").slice(0, 3))
            }
          />
          <p className="text-xs font-medium text-muted-foreground">
            Blank counts as 1 room
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {MINUTE_OPTIONS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => addMinutes(minutes)}
              className="flex min-h-16 flex-col items-center justify-center rounded-md border border-[#2e4039] bg-[#0b1311] px-2 text-center text-2xl font-semibold leading-8 text-foreground transition-colors hover:border-primary hover:bg-[#143126] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-primary active:text-primary-foreground"
            >
              {minutes}
              <span className="text-xs font-medium leading-4 text-muted-foreground">
                min
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-2 rounded-md border border-[#31453d] bg-[#0b1311] p-3">
          <Label htmlFor="custom-minutes">Custom Minutes</Label>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              id="custom-minutes"
              inputMode="numeric"
              min={1}
              type="number"
              value={customMinutes}
              onChange={(event) => setCustomMinutes(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submitCustomMinutes();
                }
              }}
            />
            <Button
              className="h-12 px-5"
              onClick={submitCustomMinutes}
              disabled={!Number(customMinutes)}
            >
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BuildingWorkflowPanel({
  activeBuilding,
  activeBuildingTotals,
  buildings,
  buildingSummaries,
  currentFloor,
  currentFloorTotals,
  floorNumbers,
  floorSummaries,
  onAddBuilding,
  onAddFloor,
  onRenameBuilding,
  onSelectBuilding,
  onSelectFloor,
}: {
  activeBuilding: BuildingInfo;
  activeBuildingTotals: ReturnType<typeof getTotals>;
  buildings: BuildingInfo[];
  buildingSummaries: ReturnType<typeof getBuildingSummaries>;
  currentFloor: number;
  currentFloorTotals: ReturnType<typeof getTotals>;
  floorNumbers: number[];
  floorSummaries: ReturnType<typeof getFloorSummaries>;
  onAddBuilding: () => void;
  onAddFloor: () => void;
  onRenameBuilding: (buildingId: string, name: string) => void;
  onSelectBuilding: (buildingId: string) => void;
  onSelectFloor: (floorNumber: number) => void;
}) {
  return (
    <Card className="bg-[#101816]">
      <CardHeader>
        <CardTitle>Building & Floor Workflow</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {buildings.map((building) => {
              const selected = activeBuilding.id === building.id;

              return (
                <button
                  key={building.id}
                  type="button"
                  onClick={() => onSelectBuilding(building.id)}
                  className={cn(
                    "min-h-12 shrink-0 rounded-md border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-[#0b1311] text-foreground hover:border-primary",
                  )}
                >
                  {building.name}
                </button>
              );
            })}
            <Button
              className="h-12 shrink-0"
              variant="secondary"
              onClick={onAddBuilding}
            >
              <Plus className="size-4" />
              Add Building
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="grid gap-2">
              <Label htmlFor="active-building-name">Active Building Name</Label>
              <Input
                id="active-building-name"
                value={activeBuilding.name}
                onChange={(event) =>
                  onRenameBuilding(activeBuilding.id, event.target.value)
                }
              />
            </div>
            <Badge className="h-12 justify-center border-[#31453d] bg-[#0b1311] text-[#cfe5d8]">
              {formatNumber(activeBuildingTotals.totalRooms, 0)} rooms in building
            </Badge>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {floorNumbers.map((floorNumber) => {
            const selected = currentFloor === floorNumber;

            return (
              <button
                key={floorNumber}
                type="button"
                onClick={() => onSelectFloor(floorNumber)}
                className={cn(
                  "min-h-12 shrink-0 rounded-md border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-[#0b1311] text-foreground hover:border-primary",
                )}
              >
                Floor {floorNumber}
              </button>
            );
          })}
          <Button className="h-12 shrink-0" variant="secondary" onClick={onAddFloor}>
            <Plus className="size-4" />
            Add Floor
          </Button>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <SummaryLine
            label={`${activeBuilding.name} Rooms`}
            value={formatNumber(activeBuildingTotals.totalRooms, 0)}
          />
          <SummaryLine
            label={`Floor ${currentFloor} Rooms`}
            value={formatNumber(currentFloorTotals.totalRooms, 0)}
          />
          <SummaryLine
            label={`Floor ${currentFloor} Minutes`}
            value={formatNumber(currentFloorTotals.totalMinutes, 0)}
          />
          <SummaryLine
            label={`Floor ${currentFloor} Hours`}
            value={formatNumber(currentFloorTotals.totalHours)}
          />
          <SummaryLine
            label="Active Floor"
            value={`${activeBuilding.name} / Floor ${currentFloor}`}
            emphasis
          />
        </div>

        <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
          {buildingSummaries.map((summary) => (
            <div
              key={summary.building.id}
              className={cn(
                "rounded-md border bg-[#0b1311] p-3",
                activeBuilding.id === summary.building.id
                  ? "border-primary/70"
                  : "border-border",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-foreground">
                  {summary.building.name}
                </p>
                <Badge className="border-[#31453d] bg-[#101816]">
                  {summary.totals.totalRooms} rooms
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <p className="text-muted-foreground">Minutes</p>
                <p className="text-right font-semibold">
                  {formatNumber(summary.totals.totalMinutes, 0)}
                </p>
                <p className="text-muted-foreground">Monthly Price</p>
                <p className="text-right font-semibold">
                  {formatCurrency(summary.cost.recommendedMonthlyContract)}
                </p>
                <p className="text-muted-foreground">Monthly Profit</p>
                <p className="text-right font-semibold text-primary">
                  {formatCurrency(summary.cost.grossMonthlyProfit)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
          {floorSummaries.map((floor) => (
            <div
              key={`${floor.buildingId}-${floor.floorNumber}`}
              className={cn(
                "rounded-md border bg-[#0b1311] p-3",
                currentFloor === floor.floorNumber
                  ? "border-primary/70"
                  : "border-border",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-foreground">
                  {floor.buildingName} / Floor {floor.floorNumber}
                </p>
                <Badge className="border-[#31453d] bg-[#101816]">
                  {floor.totals.totalRooms} rooms
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <p className="text-muted-foreground">Minutes</p>
                <p className="text-right font-semibold">
                  {formatNumber(floor.totals.totalMinutes, 0)}
                </p>
                <p className="text-muted-foreground">Monthly Price</p>
                <p className="text-right font-semibold">
                  {formatCurrency(floor.cost.recommendedMonthlyContract)}
                </p>
                <p className="text-muted-foreground">Monthly Profit</p>
                <p className="text-right font-semibold text-primary">
                  {formatCurrency(floor.cost.grossMonthlyProfit)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RoomLogPanel({
  entries,
  editingEntry,
  defaultFrequency,
  activeBuilding,
  buildings,
  currentFloor,
  floorNumbers,
  allEntries,
  logEndRef,
  onStartEdit,
  onCancelEdit,
  onChangeEdit,
  onSaveEdit,
  onDelete,
}: {
  entries: RoomEntry[];
  editingEntry: EditingEntry | null;
  defaultFrequency: CleaningFrequency;
  activeBuilding: BuildingInfo;
  buildings: BuildingInfo[];
  currentFloor: number;
  floorNumbers: number[];
  allEntries: RoomEntry[];
  logEndRef: RefObject<HTMLDivElement | null>;
  onStartEdit: (entry: RoomEntry) => void;
  onCancelEdit: () => void;
  onChangeEdit: (entry: EditingEntry) => void;
  onSaveEdit: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="bg-[#101816] xl:min-h-[520px]">
      <CardHeader>
        <CardTitle>
          {activeBuilding.name} / Floor {currentFloor} Room Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[520px] overflow-y-auto pr-1">
          {entries.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-[#344840] bg-[#0b1311] text-center text-sm text-muted-foreground">
              No rooms logged
            </div>
          ) : (
            <div className="grid gap-2">
              {entries.map((entry) => {
                const isEditing = editingEntry?.id === entry.id;
                const entryBuilding =
                  buildings.find(
                    (building) => building.id === getEntryBuildingId(entry),
                  ) ?? activeBuilding;
                const editingBuilding =
                  editingEntry && isEditing
                    ? buildings.find(
                        (building) => building.id === editingEntry.buildingId,
                      ) ?? activeBuilding
                    : activeBuilding;
                const editingFloorNumbers =
                  editingEntry && isEditing
                    ? getFloorNumbers(
                        editingBuilding.numberOfFloors,
                        allEntries,
                        editingBuilding.id,
                      )
                    : floorNumbers;

                return (
                  <div
                    key={entry.id}
                    className="rounded-md border border-border bg-[#0b1311] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-foreground">
                          {entry.roomType} #{entry.roomNumber}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {entry.minutes} min -{" "}
                          {entryBuilding.name} -{" "}
                          Floor {getEntryFloor(entry)} -{" "}
                          {entry.cleaningFrequency
                            ? normalizeCleaningFrequency(entry.cleaningFrequency)
                            : `Default: ${defaultFrequency}`}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={() => onStartEdit(entry)}
                          aria-label={`Edit ${entry.roomType} ${entry.roomNumber}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => onDelete(entry.id)}
                          aria-label={`Delete ${entry.roomType} ${entry.roomNumber}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>

                    {isEditing && editingEntry ? (
                      <div className="mt-3 grid gap-3 rounded-md border border-[#31453d] bg-[#101816] p-3">
                        <div className="grid gap-2">
                          <Label>Room Type</Label>
                          <Select
                            value={editingEntry.roomType}
                            onValueChange={(value) =>
                              onChangeEdit({
                                ...editingEntry,
                                roomType: value as RoomType,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROOM_TYPES.map((roomType) => (
                                <SelectItem key={roomType} value={roomType}>
                                  {roomType}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid gap-2">
                          <Label>Minutes</Label>
                          <Input
                            inputMode="numeric"
                            min={1}
                            type="number"
                            value={editingEntry.minutes}
                            onChange={(event) =>
                              onChangeEdit({
                                ...editingEntry,
                                minutes: Math.max(
                                  1,
                                  Math.round(Number(event.target.value) || 1),
                                ),
                              })
                            }
                          />
                          <div className="grid grid-cols-4 gap-2">
                            {MINUTE_OPTIONS.map((minutes) => (
                              <button
                                key={minutes}
                                type="button"
                                onClick={() =>
                                  onChangeEdit({ ...editingEntry, minutes })
                                }
                                className={cn(
                                  "min-h-11 rounded-md border px-2 text-sm font-semibold transition-colors",
                                  editingEntry.minutes === minutes
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-[#0b1311] text-foreground hover:border-primary",
                                )}
                              >
                                {minutes}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Label>Room Cleaning Frequency</Label>
                          <Select
                            value={editingEntry.cleaningFrequency ?? "default"}
                            onValueChange={(value) =>
                              onChangeEdit({
                                ...editingEntry,
                                cleaningFrequency:
                                  value === "default"
                                    ? undefined
                                    : (value as CleaningFrequency),
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">
                                Use default ({defaultFrequency})
                              </SelectItem>
                              {FREQUENCY_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid gap-2">
                          <Label>Building</Label>
                          <Select
                            value={editingEntry.buildingId}
                            onValueChange={(value) => {
                              const nextBuilding =
                                buildings.find((building) => building.id === value) ??
                                activeBuilding;

                              onChangeEdit({
                                ...editingEntry,
                                buildingId: value,
                                floorNumber: Math.min(
                                  editingEntry.floorNumber,
                                  normalizeFloorNumber(nextBuilding.numberOfFloors),
                                ),
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {buildings.map((building) => (
                                <SelectItem key={building.id} value={building.id}>
                                  {building.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid gap-2">
                          <Label>Floor</Label>
                          <Select
                            value={String(editingEntry.floorNumber)}
                            onValueChange={(value) =>
                              onChangeEdit({
                                ...editingEntry,
                                floorNumber: normalizeFloorNumber(Number(value)),
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {editingFloorNumbers.map((floorNumber) => (
                                <SelectItem
                                  key={floorNumber}
                                  value={String(floorNumber)}
                                >
                                  Floor {floorNumber}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" onClick={onCancelEdit}>
                            Cancel
                          </Button>
                          <Button onClick={onSaveEdit}>Save</Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProductivityPanel({ totals }: { totals: ReturnType<typeof getTotals> }) {
  return (
    <Card className="bg-[#101816]">
      <CardHeader>
        <CardTitle>Productivity Calculator</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <SummaryLine label="Total Minutes" value={formatNumber(totals.totalMinutes, 0)} />
          <SummaryLine label="Total Hours" value={formatNumber(totals.totalHours)} />
        </div>
        <div className="rounded-md border border-[#31453d] bg-[#0b1311] p-4">
          <p className="text-sm text-muted-foreground">Estimated Labor Hours</p>
          <p className="mt-1 text-3xl font-semibold leading-10 text-primary">
            {formatNumber(totals.totalHours)}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatNumber(totals.totalMinutes, 0)} minutes ={" "}
            {formatNumber(totals.totalHours)} labor hours
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StaffingPanel({
  cleaningFrequency,
  staffing,
  onChangeFrequency,
}: {
  cleaningFrequency: CleaningFrequency;
  staffing: ReturnType<typeof getStaffingTotals>;
  onChangeFrequency: (frequency: CleaningFrequency) => void;
}) {
  return (
    <Card className="bg-[#101816]">
      <CardHeader>
        <CardTitle>Staffing Engine</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label>Default Cleaning Frequency</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {FREQUENCY_OPTIONS.map((option) => {
            const selected = cleaningFrequency === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChangeFrequency(option.value)}
                className={cn(
                  "min-h-12 rounded-md border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-[#0b1311] text-foreground hover:border-primary",
                )}
              >
                {option.label}
              </button>
            );
          })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <SummaryLine
            label="Avg Daily Labor Hours"
            value={formatNumber(staffing.dailyLaborHours)}
          />
          <SummaryLine
            label="Weekly Labor Hours"
            value={formatNumber(staffing.weeklyLaborHours)}
          />
          <SummaryLine
            label="Monthly Labor Hours"
            value={formatNumber(staffing.monthlyLaborHours)}
          />
          <SummaryLine
            label="Annual Labor Hours"
            value={formatNumber(staffing.annualLaborHours)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function WalkthroughNotesPanel({
  notes,
  onChangeNotes,
}: {
  notes: string;
  onChangeNotes: (notes: string) => void;
}) {
  return (
    <Card className="bg-[#101816]">
      <CardHeader>
        <CardTitle>Walkthrough Notes</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Label htmlFor="walkthrough-notes">
          Proposal notes and special scope items
        </Label>
        <Textarea
          id="walkthrough-notes"
          value={notes}
          onChange={(event) => onChangeNotes(event.target.value)}
          placeholder="Example: Window cleaning required 3x per year. Loading dock needs weekly pressure washing. Client wants day porter option priced separately."
        />
      </CardContent>
    </Card>
  );
}

function DashboardSummary({
  totals,
  costSummary,
}: {
  totals: ReturnType<typeof getTotals>;
  costSummary: ReturnType<typeof getCostSummary>;
}) {
  return (
    <Card className="bg-[#101816]">
      <CardHeader>
        <CardTitle>Dashboard Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
          <MetricTile
            icon={ClipboardList}
            label="Total Rooms"
            value={formatNumber(totals.totalRooms, 0)}
            tone="green"
          />
          <MetricTile
            icon={Clock3}
            label="Total Minutes"
            value={formatNumber(totals.totalMinutes, 0)}
            tone="sky"
          />
          <MetricTile
            icon={Layers3}
            label="Total Hours"
            value={formatNumber(totals.totalHours)}
            tone="amber"
          />
          <MetricTile
            icon={DollarSign}
            label="Monthly Revenue"
            value={formatCurrency(costSummary.recommendedMonthlyContract)}
            tone="green"
          />
          <MetricTile
            icon={DollarSign}
            label="Monthly Profit"
            value={formatCurrency(costSummary.grossMonthlyProfit)}
            tone="sky"
          />
          <MetricTile
            icon={DollarSign}
            label="Annual Revenue"
            value={formatCurrency(costSummary.recommendedAnnualContract)}
            tone="rose"
          />
          <MetricTile
            icon={DollarSign}
            label="Annual Profit"
            value={formatCurrency(costSummary.grossAnnualProfit)}
            tone="amber"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function CostEstimatorPanel({
  pricing,
  costSummary,
  onUpdatePricing,
}: {
  pricing: PricingInputs;
  costSummary: ReturnType<typeof getCostSummary>;
  onUpdatePricing: <K extends keyof PricingInputs>(field: K, value: number) => void;
}) {
  return (
    <Card className="bg-[#101816]">
      <CardHeader>
        <CardTitle>Cost Estimator</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <PricingInput
            label="Hourly Wage"
            value={pricing.hourlyWage}
            prefix="$"
            onChange={(value) => onUpdatePricing("hourlyWage", value)}
          />
          <PricingInput
            label="Payroll Burden %"
            value={pricing.payrollBurdenPercent}
            suffix="%"
            onChange={(value) => onUpdatePricing("payrollBurdenPercent", value)}
          />
          <PricingInput
            label="Overhead %"
            value={pricing.overheadPercent}
            suffix="%"
            onChange={(value) => onUpdatePricing("overheadPercent", value)}
          />
          <PricingInput
            label="Profit %"
            value={pricing.profitPercent}
            suffix="%"
            onChange={(value) => onUpdatePricing("profitPercent", value)}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryLine
            label="Direct Labor Cost"
            value={formatCurrency(costSummary.monthlyDirectLaborCost)}
          />
          <SummaryLine
            label="Loaded Labor Cost"
            value={formatCurrency(costSummary.monthlyLoadedLaborCost)}
          />
          <SummaryLine
            label="Monthly Cost"
            value={formatCurrency(costSummary.monthlyCost)}
          />
          <SummaryLine
            label="Annual Cost"
            value={formatCurrency(costSummary.annualCost)}
          />
          <SummaryLine
            label="Monthly Profit"
            value={formatCurrency(costSummary.grossMonthlyProfit)}
            emphasis
          />
          <SummaryLine
            label="Annual Profit"
            value={formatCurrency(costSummary.grossAnnualProfit)}
            emphasis
          />
          <SummaryLine
            label="Recommended Contract Price"
            value={formatCurrency(costSummary.recommendedMonthlyContract)}
            emphasis
          />
          <SummaryLine
            label="Annual Contract Price"
            value={formatCurrency(costSummary.recommendedAnnualContract)}
            emphasis
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PricingInput({
  label,
  value,
  prefix,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <Input
          className={cn(prefix && "pl-7", suffix && "pr-9")}
          inputMode="decimal"
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SavedWalkthroughsPanel({
  historyMode,
  savedEstimates,
  status,
  onDelete,
  onExportPdf,
  onGenerateProposal,
  onReopen,
  onSaveCurrent,
}: {
  historyMode: HistoryMode;
  savedEstimates: EstimateDraft[];
  status: {
    tone: "success" | "error";
    message: string;
  } | null;
  onDelete: (id: string) => void;
  onExportPdf: (estimate: EstimateDraft) => void;
  onGenerateProposal: (estimate: EstimateDraft) => void;
  onReopen: (estimate: EstimateDraft) => void;
  onSaveCurrent: () => void;
}) {
  return (
    <Card className="bg-[#101816]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Saved Walkthroughs</CardTitle>
          <Badge
            className={cn(
              "border-[#31453d] bg-[#0b1311]",
              historyMode === "cloud" ? "text-primary" : "text-[#fbbf24]",
            )}
          >
            {historyMode === "cloud" ? "Cloud Storage" : "Local Fallback"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Button className="h-12" onClick={onSaveCurrent}>
          <Archive className="size-4" />
          Save Walkthrough
        </Button>

        {status ? (
          <div
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium",
              status.tone === "success"
                ? "border-primary/50 bg-primary/10 text-[#c7f8d9]"
                : "border-destructive/60 bg-destructive/10 text-[#ffd0d0]",
            )}
          >
            {status.message}
          </div>
        ) : null}

        <div className="grid gap-2">
          {savedEstimates.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#344840] bg-[#0b1311] p-4 text-center text-sm text-muted-foreground">
              No saved walkthroughs yet
            </div>
          ) : (
            savedEstimates.map((estimate) => {
              const totals = getTotals(estimate.entries);
              const staffing = getStaffingTotals(
                estimate.entries,
                normalizeCleaningFrequency(estimate.cleaningFrequency),
              );
              const cost = getCostSummary(staffing, estimate.pricing);

              return (
                <div
                  key={estimate.id}
                  className="rounded-md border border-border bg-[#0b1311] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">
                        {facilityLabel(estimate.facility)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {estimate.facility.clientName || "No client"} -{" "}
                        {estimate.savedAt
                          ? new Date(estimate.savedAt).toLocaleString()
                          : "Saved"}
                      </p>
                    </div>
                    <Badge className="border-[#31453d] bg-[#101816]">
                      {totals.totalRooms} rooms
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <p className="text-muted-foreground">Monthly Price</p>
                    <p className="text-right font-semibold">
                      {formatCurrency(cost.recommendedMonthlyContract)}
                    </p>
                    <p className="text-muted-foreground">Annual Price</p>
                    <p className="text-right font-semibold">
                      {formatCurrency(cost.recommendedAnnualContract)}
                    </p>
                    <p className="text-muted-foreground">Proposal</p>
                    <p className="text-right font-semibold">
                      {estimate.proposalGeneratedAt ? "Ready" : "Not generated"}
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      className="h-10"
                      variant="secondary"
                      onClick={() => onReopen(estimate)}
                    >
                      <RotateCcw className="size-4" />
                      Open
                    </Button>
                    <Button
                      className="h-10"
                      onClick={() => onGenerateProposal(estimate)}
                    >
                      <FileText className="size-4" />
                      Proposal
                    </Button>
                    <Button
                      className="h-10"
                      variant="secondary"
                      onClick={() => onExportPdf(estimate)}
                    >
                      <FileText className="size-4" />
                      PDF
                    </Button>
                    <Button
                      className="h-10"
                      variant="destructive"
                      onClick={() => onDelete(estimate.id)}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ExportPanel({
  status,
  onProposal,
  onPdf,
  onExcel,
  onCsv,
}: {
  status: {
    tone: "success" | "error";
    message: string;
  } | null;
  onProposal: () => void;
  onPdf: () => void;
  onExcel: () => void;
  onCsv: () => void;
}) {
  return (
    <Card className="bg-[#101816]">
      <CardHeader>
        <CardTitle>Export Features</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Button
            className="h-12"
            onClick={onProposal}
          >
            <FileText className="size-4" />
            Proposal PDF
          </Button>
          <Button
            className="h-12"
            variant="secondary"
            onClick={onPdf}
          >
            <FileText className="size-4" />
            PDF Estimate
          </Button>
          <Button
            className="h-12"
            variant="secondary"
            onClick={onExcel}
          >
            <FileSpreadsheet className="size-4" />
            Excel Export
          </Button>
          <Button
            className="h-12"
            variant="secondary"
            onClick={onCsv}
          >
            <Download className="size-4" />
            CSV Export
          </Button>
        </div>
        {status ? (
          <div
            className={cn(
              "mt-3 rounded-md border px-3 py-2 text-sm font-medium",
              status.tone === "success"
                ? "border-primary/50 bg-primary/10 text-[#c7f8d9]"
                : "border-destructive/60 bg-destructive/10 text-[#ffd0d0]",
            )}
          >
            {status.message}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryLine({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-h-[82px] rounded-md border border-border bg-[#0b1311] p-3",
        emphasis && "border-primary/70 bg-[#123021]",
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold leading-7 text-foreground">
        {value}
      </p>
    </div>
  );
}
