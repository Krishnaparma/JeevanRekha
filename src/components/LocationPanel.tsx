"use client";

import {
  BED_TYPES,
  SEVERITIES,
  type AlgorithmStats,
  type BedType,
  type GraphNodeDto,
  type Severity,
} from "@/lib/types";
import { Button, Chip, IconGraph, IconHeap, IconPin, IconPulse, Panel, StatTile } from "./ui";

interface LocationPanelProps {
  nodes: GraphNodeDto[];
  fromCode: string;
  onFromCode: (code: string) => void;
  patientName: string;
  onPatientName: (value: string) => void;
  patientAge: number;
  onPatientAge: (value: number) => void;
  severity: Severity;
  onSeverity: (value: Severity) => void;
  bedType: BedType;
  onBedType: (value: BedType) => void;
  onSearch: () => void;
  searching: boolean;
  showExploration: boolean;
  onShowExploration: (value: boolean) => void;
  algorithm: AlgorithmStats | null;
}

export default function LocationPanel({
  nodes,
  fromCode,
  onFromCode,
  patientName,
  onPatientName,
  patientAge,
  onPatientAge,
  severity,
  onSeverity,
  bedType,
  onBedType,
  onSearch,
  searching,
  showExploration,
  onShowExploration,
  algorithm,
}: LocationPanelProps) {
  const selectable = nodes.filter((node) => node.kind !== "hospital");
  const named = selectable.filter((node) => node.name);
  const unnamed = selectable.filter((node) => !node.name);
  const districts = Array.from(new Set(named.map((node) => node.district ?? "Other"))).sort();
  const current = nodes.find((node) => node.code === fromCode);

  const inputClass =
    "focus-ring w-full rounded-lg border border-white/10 bg-night-950/70 px-3 py-2 text-xs text-mist-100 outline-none transition hover:border-white/20 placeholder:text-mist-700";

  return (
    <div className="space-y-4">
      <Panel
        step="Step 1"
        title="Marij kahaan hai? · Where is the patient?"
        subtitle="Pick your locality — or tap any chowk on the Suryanagar map."
        right={<IconPin className="h-4 w-4 text-signal-400" />}
      >
        <label className="label-caps mb-1.5 block" htmlFor="location-select">
          Locality / chowk
        </label>
        <select
          id="location-select"
          className={`${inputClass} appearance-none font-mono`}
          value={fromCode}
          onChange={(event) => onFromCode(event.target.value)}
        >
          {districts.map((district) => (
            <optgroup key={district} label={district}>
              {named
                .filter((node) => (node.district ?? "Other") === district)
                .map((node) => (
                  <option key={node.code} value={node.code}>
                    {node.name} · {node.code}
                  </option>
                ))}
            </optgroup>
          ))}
          <optgroup label="Unnamed chowks">
            {unnamed.map((node) => (
              <option key={node.code} value={node.code}>
                Chowk {node.code}
              </option>
            ))}
          </optgroup>
        </select>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip tone="info">{current?.code ?? "—"}</Chip>
          {current?.district && <Chip>{current.district}</Chip>}
          <Chip tone="neutral">
            x {current ? current.x.toFixed(2) : "—"} km · y {current ? current.y.toFixed(2) : "—"} km
          </Chip>
        </div>
      </Panel>

      <Panel
        step="Step 2"
        title="Patient & bed requirement"
        subtitle="Severity drives the default bed category."
        right={<IconPulse className="h-4 w-4 text-critical-400" />}
      >
        <div className="grid grid-cols-[1fr_84px] gap-2">
          <div>
            <label className="label-caps mb-1 block" htmlFor="patient-name">
              Patient
            </label>
            <input
              id="patient-name"
              className={inputClass}
              value={patientName}
              maxLength={48}
              placeholder="e.g. Aarav Sharma"
              onChange={(event) => onPatientName(event.target.value)}
            />
          </div>
          <div>
            <label className="label-caps mb-1 block" htmlFor="patient-age">
              Age
            </label>
            <input
              id="patient-age"
              type="number"
              min={0}
              max={120}
              className={`${inputClass} font-mono`}
              value={Number.isFinite(patientAge) ? patientAge : 0}
              onChange={(event) => onPatientAge(Number.parseInt(event.target.value, 10))}
            />
          </div>
        </div>

        <div className="mt-3">
          <span className="label-caps mb-1.5 block">Triage severity</span>
          <div className="grid grid-cols-3 gap-1.5">
            {SEVERITIES.map((option) => {
              const active = severity === option.id;
              const tone =
                option.id === "critical"
                  ? "border-critical-400/60 bg-critical-500/15 text-critical-300"
                  : option.id === "urgent"
                    ? "border-alert-400/60 bg-alert-500/15 text-alert-300"
                    : "border-signal-400/60 bg-signal-500/15 text-signal-300";
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onSeverity(option.id);
                    onBedType(option.bed);
                  }}
                  title={option.hint}
                  className={`focus-ring rounded-lg border px-2 py-1.5 text-left text-[11px] font-semibold transition ${
                    active ? tone : "border-white/10 bg-white/[0.02] text-mist-500 hover:text-mist-100"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-mist-500">
            {SEVERITIES.find((s) => s.id === severity)?.hint}
          </p>
        </div>

        <div className="mt-3">
          <span className="label-caps mb-1.5 block">Bed category required</span>
          <div className="grid grid-cols-2 gap-1.5">
            {BED_TYPES.map((bed) => {
              const active = bedType === bed.id;
              return (
                <button
                  key={bed.id}
                  type="button"
                  onClick={() => onBedType(bed.id)}
                  className={`focus-ring rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${
                    active
                      ? "border-signal-400/60 bg-signal-500/15 text-signal-300"
                      : "border-white/10 bg-white/[0.02] text-mist-500 hover:text-mist-100"
                  }`}
                >
                  {bed.label}
                </button>
              );
            })}
          </div>
        </div>

        <Button
          variant="danger"
          size="lg"
          className="mt-4 w-full"
          onClick={onSearch}
          disabled={searching}
          icon={<IconPulse className="h-4 w-4" />}
        >
          {searching ? "Routing through Suryanagar…" : "Find nearest khaali bed"}
        </Button>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11px] text-mist-300">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-[#2ee0c2]"
            checked={showExploration}
            onChange={(event) => onShowExploration(event.target.checked)}
          />
          Show Dijkstra exploration order on the map
        </label>
      </Panel>

      <Panel
        title="Algorithm trace"
        subtitle="What the last query actually did"
        right={<IconHeap className="h-4 w-4 text-signal-400" />}
      >
        {algorithm ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Nodes settled" value={algorithm.nodesSettled} hint={`of ${algorithm.nodesInGraph} vertices`} />
              <StatTile label="Edge relaxations" value={algorithm.edgeRelaxations} hint={`${algorithm.edgesInGraph} edges`} tone="warn" />
              <StatTile
                label="Heap push / pop"
                value={`${algorithm.heapPushes}/${algorithm.heapPops}`}
                hint={`${algorithm.heapSwaps} sift swaps`}
                tone="good"
              />
              <StatTile label="Query time" value={algorithm.durationMs} unit="ms" hint="Dijkstra + ranking heap" />
            </div>
            <p className="mt-2 flex items-start gap-1.5 font-mono text-[10px] leading-snug text-mist-500">
              <IconGraph className="mt-px h-3 w-3 shrink-0" />
              {algorithm.complexity}
            </p>
          </>
        ) : (
          <p className="text-[11px] leading-relaxed text-mist-500">
            Run a search to see how many vertices Dijkstra settled and how many priority-queue
            operations the ranking needed.
          </p>
        )}
      </Panel>
    </div>
  );
}
