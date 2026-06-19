"use client";

import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Camera,
  ClipboardList,
  Clock3,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Layers3,
  Mic,
  Pencil,
  Play,
  QrCode,
  Save,
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
import {
  buildEstimateDraft,
  createRoomEntry,
  facilityLabel,
  formatCurrency,
  formatNumber,
  getCostSummary,
  getRoomBreakdown,
  getStaffingTotals,
  getTotals,
  normalizeCleaningFrequency,
  updateRoomEntry,
} from "@/lib/calculations";
import {
  DEFAULT_FACILITY,
  DEFAULT_PRICING,
  FACILITY_TYPES,
  FREQUENCY_OPTIONS,
  MINUTE_OPTIONS,
  ROOM_TYPES,
} from "@/lib/constants";
import {
  exportCsvEstimate,
  exportExcelEstimate,
  exportPdfEstimate,
} from "@/lib/exports";
import { clearActiveEstimate, loadActiveEstimate, saveActiveEstimate } from "@/lib/storage";
import type {
  CleaningFrequency,
  FacilityInfo,
  FacilityType,
  PricingInputs,
  RoomEntry,
  RoomType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type AppStep = "facility" | "walkthrough";

type EditingEntry = {
  id: string;
  roomType: RoomType;
  minutes: number;
  cleaningFrequency?: CleaningFrequency;
};

const roomAccentClasses = [
  "bg-[#42d77d]",
  "bg-[#38bdf8]",
  "bg-[#fbbf24]",
  "bg-[#fb7185]",
  "bg-[#a3e635]",
];

export function EstimatorApp() {
  const [step, setStep] = useState<AppStep>("facility");
  const [facility, setFacility] = useState<FacilityInfo>({ ...DEFAULT_FACILITY });
  const [entries, setEntries] = useState<RoomEntry[]>([]);
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType>("Classroom");
  const [cleaningFrequency, setCleaningFrequency] =
    useState<CleaningFrequency>("5 days/week");
  const [pricing, setPricing] = useState<PricingInputs>({ ...DEFAULT_PRICING });
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"loading" | "saving" | "saved">(
    "loading",
  );
  const [exportStatus, setExportStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const totals = useMemo(() => getTotals(entries), [entries]);
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
  const estimateDraft = useMemo(
    () =>
      buildEstimateDraft({
        facility,
        entries,
        selectedRoomType,
        cleaningFrequency,
        pricing,
      }),
    [cleaningFrequency, entries, facility, pricing, selectedRoomType],
  );

  useEffect(() => {
    let mounted = true;

    async function restoreDraft() {
      const savedDraft = await loadActiveEstimate();

      if (!mounted) {
        return;
      }

      if (savedDraft) {
        setFacility({ ...DEFAULT_FACILITY, ...savedDraft.facility });
        setEntries(savedDraft.entries ?? []);
        setSelectedRoomType(savedDraft.selectedRoomType ?? "Classroom");
        setCleaningFrequency(
          normalizeCleaningFrequency(savedDraft.cleaningFrequency),
        );
        setPricing({ ...DEFAULT_PRICING, ...savedDraft.pricing });
        setStep(savedDraft.entries?.length ? "walkthrough" : "facility");
      }

      setDraftLoaded(true);
      setSaveStatus("saved");
    }

    restoreDraft();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!draftLoaded) {
      return;
    }

    const handle = window.setTimeout(() => {
      setSaveStatus("saving");
      saveActiveEstimate(estimateDraft)
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("saved"));
    }, 180);

    return () => window.clearTimeout(handle);
  }, [draftLoaded, estimateDraft]);

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

  function addEntry(minutes: number) {
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return;
    }

    setEntries((currentEntries) => [
      ...currentEntries,
      createRoomEntry(currentEntries, selectedRoomType, Math.round(minutes)),
    ]);
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
        minutes: editingEntry.minutes,
        cleaningFrequency: editingEntry.cleaningFrequency,
      }),
    );
    setEditingEntry(null);
  }

  async function startNewEstimate() {
    setFacility({ ...DEFAULT_FACILITY });
    setEntries([]);
    setSelectedRoomType("Classroom");
    setCleaningFrequency("5 days/week");
    setPricing({ ...DEFAULT_PRICING });
    setEditingEntry(null);
    setStep("facility");
    await clearActiveEstimate();
    setSaveStatus("saved");
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

  if (step === "facility") {
    return (
      <FacilityScreen
        facility={facility}
        saveStatus={saveStatus}
        onStart={() => setStep("walkthrough")}
        onUpdateFacility={updateFacility}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-[#07110f] text-foreground">
      <RunningTotalsBar
        totals={totals}
        breakdown={breakdown}
        facilityName={facilityLabel(facility)}
        saveStatus={saveStatus}
        onBack={() => setStep("facility")}
        onNewEstimate={startNewEstimate}
      />

      <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-3 py-4 sm:px-5 lg:px-6">
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
            entries={entries}
            editingEntry={editingEntry}
            defaultFrequency={cleaningFrequency}
            logEndRef={logEndRef}
            onStartEdit={(entry) =>
              setEditingEntry({
                id: entry.id,
                roomType: entry.roomType,
                minutes: entry.minutes,
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
          </div>

          <div className="grid gap-4">
            <DashboardSummary totals={totals} costSummary={costSummary} />
            <CostEstimatorPanel
              pricing={pricing}
              costSummary={costSummary}
              onUpdatePricing={updatePricing}
            />
            <ExportPanel
              status={exportStatus}
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

function FacilityScreen({
  facility,
  saveStatus,
  onStart,
  onUpdateFacility,
}: {
  facility: FacilityInfo;
  saveStatus: "loading" | "saving" | "saved";
  onStart: () => void;
  onUpdateFacility: <K extends keyof FacilityInfo>(
    field: K,
    value: FacilityInfo[K],
  ) => void;
}) {
  return (
    <main className="min-h-dvh bg-[#07110f] px-4 py-5 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-5xl flex-col gap-5">
        <AppHeader saveStatus={saveStatus} />

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
  saveStatus,
}: {
  saveStatus: "loading" | "saving" | "saved";
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
      <Badge className="gap-2 border-[#31453d] bg-[#101816] text-[#cfe5d8]">
        <Save className="size-4 text-primary" />
        {saveStatus === "loading"
          ? "Loading local database"
          : saveStatus === "saving"
            ? "Saving"
            : "Saved locally"}
      </Badge>
    </header>
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
  saveStatus,
  onBack,
  onNewEstimate,
}: {
  totals: ReturnType<typeof getTotals>;
  breakdown: ReturnType<typeof getRoomBreakdown>;
  facilityName: string;
  saveStatus: "loading" | "saving" | "saved";
  onBack: () => void;
  onNewEstimate: () => void;
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
                {saveStatus === "saving" ? "Saving" : "Saved to local database"}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={onNewEstimate}>
            <X className="size-4" />
            New Estimate
          </Button>
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
  onAddMinutes: (minutes: number) => void;
}) {
  const [customMinutes, setCustomMinutes] = useState("");

  function submitCustomMinutes() {
    const minutes = Number(customMinutes);

    if (!Number.isFinite(minutes) || minutes <= 0) {
      return;
    }

    onAddMinutes(minutes);
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

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {MINUTE_OPTIONS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => onAddMinutes(minutes)}
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

function RoomLogPanel({
  entries,
  editingEntry,
  defaultFrequency,
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
        <CardTitle>Room Log Panel</CardTitle>
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

function ExportPanel({
  status,
  onPdf,
  onExcel,
  onCsv,
}: {
  status: {
    tone: "success" | "error";
    message: string;
  } | null;
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
        <div className="grid gap-2 sm:grid-cols-3">
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
