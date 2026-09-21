"use client";

import { useEffect, useState } from "react";
import {
  bedShort,
  severityLabel,
  type BedEventDto,
  type BedRequestDto,
  type RequestStatus,
} from "@/lib/types";
import { Button, Chip, IconAmbulance, IconCross, IconPhone, IconPulse, Panel } from "./ui";

const STEPS: { id: RequestStatus; label: string; hint: string }[] = [
  { id: "reserved", label: "Bed blocked", hint: "Hospital control room informed" },
  { id: "dispatched", label: "108 sent", hint: "Ambulance crew assigned" },
  { id: "en_route", label: "On the way", hint: "Following the shortest path" },
  { id: "admitted", label: "Admitted", hint: "Patient handed over in casualty" },
];

function statusTone(status: RequestStatus): "good" | "warn" | "bad" | "info" {
  if (status === "admitted") return "good";
  if (status === "cancelled") return "bad";
  return "warn";
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function DispatchPanel({
  dispatch,
  onAdvance,
  onCancel,
  busy,
}: {
  dispatch: BedRequestDto | null;
  onAdvance: (status: RequestStatus) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  if (!dispatch) return null;

  const stepIndex = STEPS.findIndex((step) => step.id === dispatch.status);
  const cancelled = dispatch.status === "cancelled";
  const closed = dispatch.status === "admitted" || cancelled;
  const progress = cancelled ? 0 : ((stepIndex + 1) / STEPS.length) * 100;

  const nextAction: { label: string; status: RequestStatus } | null = closed
    ? null
      : dispatch.status === "reserved"
        ? { label: "Send 108 ambulance", status: "dispatched" }
        : dispatch.status === "dispatched"
          ? { label: "Ambulance nikal gayi", status: "en_route" }
          : { label: "Mark admitted", status: "admitted" };

  return (
    <Panel
      step="Active dispatch"
      title={`${dispatch.code} · ${dispatch.hospitalName}`}
      subtitle={`${dispatch.patientName}, ${dispatch.patientAge} · ${severityLabel(dispatch.severity)} · ${bedShort(dispatch.bedType)} bed`}
      right={<Chip tone={statusTone(dispatch.status)}>{dispatch.status.replace("_", " ")}</Chip>}
      className="border-signal-400/25"
    >
      <div className="grid grid-cols-3 gap-2">
        <div className="panel-flat rounded-lg px-2.5 py-2">
          <div className="label-caps">ETA</div>
          <div className="font-mono text-base text-alert-300">{dispatch.etaMinutes} min</div>
        </div>
        <div className="panel-flat rounded-lg px-2.5 py-2">
          <div className="label-caps">Distance</div>
          <div className="font-mono text-base text-mist-100">{dispatch.distanceKm} km</div>
        </div>
        <div className="panel-flat rounded-lg px-2.5 py-2">
          <div className="label-caps">From</div>
          <div className="truncate font-mono text-[11px] leading-6 text-mist-100">{dispatch.fromLabel}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
          <div
            className={`h-full rounded-full transition-all duration-700 ${cancelled ? "bg-critical-400" : "bg-signal-400"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <ol className="mt-2 grid grid-cols-4 gap-1">
          {STEPS.map((step, index) => {
            const done = !cancelled && index <= stepIndex;
            return (
              <li key={step.id} className="text-center">
                <div
                  className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[10px] font-bold ${
                    done
                      ? "border-signal-400/60 bg-signal-500/20 text-signal-300"
                      : "border-white/12 bg-white/[0.02] text-mist-700"
                  }`}
                >
                  {index + 1}
                </div>
                <div className={`mt-1 text-[9.5px] leading-tight ${done ? "text-mist-300" : "text-mist-700"}`}>
                  {step.label}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {dispatch.roads.length > 0 && (
        <div className="mt-3 rounded-lg border border-white/8 bg-night-950/50 p-2">
          <div className="label-caps mb-1">Ambulance path</div>
          <p className="font-mono text-[10px] leading-relaxed text-mist-300">
            {dispatch.roads.join(" → ")}
          </p>
          <p className="mt-1 font-mono text-[9.5px] text-mist-700">
            vertices: {dispatch.pathCodes.join(" · ")} | settled {dispatch.nodesSettled} nodes,{" "}
            {dispatch.heapOps} heap ops
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {nextAction && (
          <Button
            variant="primary"
            size="md"
            disabled={busy}
            icon={<IconAmbulance className="h-4 w-4" />}
            onClick={() => onAdvance(nextAction.status)}
          >
            {nextAction.label}
          </Button>
        )}
        {!closed && (
          <Button variant="outline" size="md" disabled={busy} icon={<IconPhone className="h-4 w-4" />} onClick={onCancel}>
            Release bed
          </Button>
        )}
        {closed && (
          <Chip tone={statusTone(dispatch.status)}>
            <IconCross className="h-3 w-3" />{" "}
            {cancelled ? "block released, bed back in the pool" : "patient admitted"}
          </Chip>
        )}
      </div>
    </Panel>
  );
}

export function ActivityFeed({
  requests,
  events,
  onReplay,
}: {
  requests: BedRequestDto[];
  events: BedEventDto[];
  onReplay: (request: BedRequestDto) => void;
}) {
  // Relative timestamps are client-only, otherwise SSR/CSR markup would differ.
  const [mounted, setMounted] = useState(false);
  const [stamp, setStamp] = useState(0);
  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setStamp((value) => value + 1), 30000);
    return () => clearInterval(id);
  }, []);
  void stamp;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="Dispatch log"
        subtitle="Every bed reservation stored in PostgreSQL"
        right={<IconAmbulance className="h-4 w-4 text-alert-400" />}
      >
        {requests.length === 0 ? (
          <p className="py-3 text-[11px] text-mist-500">
            No dispatches yet. Reserve a bed and it will be logged here with the exact path Dijkstra
            chose.
          </p>
        ) : (
          <ul className="thin-scroll max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
            {requests.map((request) => (
              <li
                key={request.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-semibold text-mist-100">
                    {request.patientName}
                    <span className="ml-1.5 font-mono text-[9.5px] text-mist-500">{request.code}</span>
                  </div>
                  <div className="truncate font-mono text-[9.5px] text-mist-500">
                    {request.fromLabel} → {request.hospitalName} · {request.distanceKm} km ·{" "}
                    {request.etaMinutes}′
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Chip tone={statusTone(request.status)}>{request.status.replace("_", " ")}</Chip>
                  <Button size="sm" variant="ghost" onClick={() => onReplay(request)}>
                    replay
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Live bed feed"
        subtitle="Occupancy changes streaming from the hospitals"
        right={<IconPulse className="h-4 w-4 text-signal-400" />}
      >
        {events.length === 0 ? (
          <p className="py-3 text-[11px] text-mist-500">No occupancy changes recorded yet.</p>
        ) : (
          <ul className="thin-scroll max-h-[220px] space-y-1 overflow-y-auto pr-1">
            {events.map((event) => (
              <li key={event.id} className="flex items-center gap-2 border-b border-white/5 py-1 last:border-0">
                <span
                  className={`font-mono text-[11px] font-bold ${
                    event.delta > 0 ? "text-signal-300" : event.delta < 0 ? "text-critical-300" : "text-mist-500"
                  }`}
                >
                  {event.delta > 0 ? "+1" : event.delta < 0 ? "−1" : "•"}
                </span>
                <span className="w-9 shrink-0 font-mono text-[9px] text-mist-700">
                  {bedShort(event.bedType)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10.5px] text-mist-300">{event.hospitalName}</div>
                  <div className="truncate text-[9.5px] text-mist-700">{event.reason}</div>
                </div>
                <span className="shrink-0 font-mono text-[9px] text-mist-700">
                  {mounted ? timeAgo(event.createdAt) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
