"use client";

import {
  availableBeds,
  bedShort,
  severityLabel,
  type BedType,
  type HospitalMatch,
  type RouteResponse,
} from "@/lib/types";
import { BedStrip, Button, Chip, IconAlert, IconAmbulance, IconPhone, IconRoute, Panel, bedTone } from "./ui";

interface ResultsPanelProps {
  route: RouteResponse | null;
  bedType: BedType;
  activeMatchId: number | null;
  onActiveMatch: (match: HospitalMatch | null) => void;
  onReserve: (match: HospitalMatch) => void;
  reservingId: number | null;
  searching: boolean;
  error: string | null;
  dispatchHospitalId: number | null;
}

function RankBadge({ rank, tone }: { rank: number; tone: "best" | "ok" | "none" }) {
  const styles = {
    best: "border-signal-400/60 bg-signal-500/20 text-signal-300",
    ok: "border-white/15 bg-white/[0.04] text-mist-300",
    none: "border-critical-400/40 bg-critical-500/10 text-critical-300",
  }[tone];
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono text-[12px] font-bold ${styles}`}
    >
      {rank}
    </span>
  );
}

export default function ResultsPanel({
  route,
  bedType,
  activeMatchId,
  onActiveMatch,
  onReserve,
  reservingId,
  searching,
  error,
  dispatchHospitalId,
}: ResultsPanelProps) {
  if (error) {
    return (
      <Panel title="Dispatch result" right={<IconAlert className="h-4 w-4 text-critical-400" />}>
        <p className="rounded-lg border border-critical-400/30 bg-critical-500/10 px-3 py-2 text-[11px] leading-relaxed text-critical-300">
          {error}
        </p>
      </Panel>
    );
  }

  if (!route) {
    return (
      <Panel title="Nearby hospitals" subtitle="Ranked by real road travel time, not crow flies">
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <IconRoute className="h-7 w-7 text-mist-700" />
          <p className="max-w-[260px] text-[11px] leading-relaxed text-mist-500">
            Choose the patient&apos;s locality and press{" "}
            <span className="text-mist-100">Find nearest khaali bed</span>. Dijkstra will sweep the
            Suryanagar road graph and a min-heap will rank every hospital by ETA.
          </p>
        </div>
      </Panel>
    );
  }

  const suggestion = route.suggestion;
  const ranked = route.matches;
  const satisfied = ranked.filter((m) => m.satisfied);
  const exhausted = ranked.filter((m) => !m.satisfied);

  return (
    <div className="space-y-4">
      <Panel
        step="Suggested"
        title={suggestion ? suggestion.hospital.name : "No bed available in this category"}
        subtitle={
          suggestion
            ? `${severityLabel(route.severity)} case · ${bedShort(bedType)} bed · nearest reachable with capacity`
            : "Every hospital below is full for the requested bed type"
        }
        right={
          suggestion ? (
            <Chip tone="good">
              <IconAmbulance className="h-3 w-3" /> go now
            </Chip>
          ) : (
            <Chip tone="bad">
              <IconAlert className="h-3 w-3" /> full
            </Chip>
          )
        }
      >
        {suggestion ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="panel-flat rounded-lg px-3 py-2">
                <div className="label-caps">ETA</div>
                <div className="font-mono text-xl leading-tight text-signal-300">
                  {suggestion.etaMinutes}
                  <span className="ml-1 text-[10px] text-mist-500">min</span>
                </div>
              </div>
              <div className="panel-flat rounded-lg px-3 py-2">
                <div className="label-caps">Road distance</div>
                <div className="font-mono text-xl leading-tight text-mist-100">
                  {suggestion.distanceKm}
                  <span className="ml-1 text-[10px] text-mist-500">km</span>
                </div>
              </div>
              <div className="panel-flat rounded-lg px-3 py-2">
                <div className="label-caps">{bedShort(bedType)} free</div>
                <div className="font-mono text-xl leading-tight text-signal-300">
                  {suggestion.availableInCategory}
                  <span className="ml-1 text-[10px] text-mist-500">
                    /{suggestion.hospital.beds[bedType].total}
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-mist-300">{suggestion.reason}</p>

            <div className="mt-3 rounded-lg border border-white/8 bg-night-950/50 p-2.5">
              <div className="label-caps mb-1">Route · {suggestion.hops} road segments</div>
              <div className="flex flex-wrap gap-1">
                {suggestion.roads.map((road, index) => (
                  <span key={`${road}-${index}`} className="font-mono text-[10px] text-mist-300">
                    {index > 0 && <span className="mr-1 text-signal-400">→</span>}
                    {road}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="md"
                icon={<IconAmbulance className="h-4 w-4" />}
                disabled={reservingId !== null || dispatchHospitalId === suggestion.hospital.id}
                onClick={() => onReserve(suggestion)}
              >
                {reservingId === suggestion.hospital.id
                  ? "Blocking bed…"
                  : dispatchHospitalId === suggestion.hospital.id
                    ? "Bed already blocked"
                    : "Block this bed"}
              </Button>
              <Button size="md" icon={<IconPhone className="h-4 w-4" />} onClick={() => onActiveMatch(suggestion)}>
                {suggestion.hospital.phone}
              </Button>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-alert-400/30 bg-alert-400/10 p-3">
            <p className="text-[11px] leading-relaxed text-alert-300">
              No hospital in Suryanagar has a khaali {bedShort(bedType)} bed right now. The list below
              is still ordered by travel time, and hospitals with other bed types free are shown so the
              duty doctor can arrange a referral or a stretcher bed in casualty.
            </p>
          </div>
        )}
      </Panel>

      <Panel
        title={`Nearby hospitals · ${ranked.length} ranked`}
        subtitle={`${satisfied.length} with a free ${bedShort(bedType)} bed · ordered by the hospital priority queue`}
        right={
          searching ? (
            <span className="font-mono text-[10px] text-signal-300 blink">recalculating…</span>
          ) : (
            <Chip tone="neutral">{route.algorithm.nodesSettled} nodes settled</Chip>
          )
        }
        className="overflow-hidden"
      >
        <div className="thin-scroll -mr-2 max-h-[560px] space-y-2 overflow-y-auto pr-2">
          {ranked.map((match) => {
            const free = availableBeds(match.hospital.beds, bedType);
            const tone = bedTone(free, match.hospital.beds[bedType].total);
            const isActive = activeMatchId === match.hospital.id;
            const isSuggested = suggestion?.hospital.id === match.hospital.id;
            const isDispatched = dispatchHospitalId === match.hospital.id;
            return (
              <article
                key={match.hospital.id}
                onMouseEnter={() => onActiveMatch(match)}
                onFocus={() => onActiveMatch(match)}
                className={`rise-in rounded-lg border p-2.5 transition ${
                  isActive
                    ? "border-signal-400/50 bg-signal-400/[0.06]"
                    : match.satisfied
                      ? "border-white/10 bg-white/[0.02] hover:border-white/25"
                      : "border-white/6 bg-white/[0.01] opacity-70"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <RankBadge
                    rank={match.rank}
                    tone={isSuggested ? "best" : match.satisfied ? "ok" : "none"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate text-[12.5px] font-semibold text-mist-100">
                        {match.hospital.name}
                      </h3>
                      <div className="shrink-0 text-right">
                        <div className={`font-mono text-[13px] font-bold ${tone === "bad" ? "text-critical-300" : "text-signal-300"}`}>
                          {match.etaMinutes}′
                        </div>
                        <div className="font-mono text-[9.5px] text-mist-500">{match.distanceKm} km</div>
                      </div>
                    </div>
                    <p className="mt-0.5 truncate text-[10.5px] text-mist-500">{match.hospital.address}</p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <Chip tone={tone === "good" ? "good" : tone === "warn" ? "warn" : "bad"}>
                        {free} {bedShort(bedType)} free
                      </Chip>
                      <Chip>Level {match.hospital.traumaLevel} trauma</Chip>
                      {match.hospital.hasBloodBank && <Chip tone="info">blood bank</Chip>}
                      {match.hospital.ambulances > 0 && (
                        <Chip>{match.hospital.ambulances} ambulances</Chip>
                      )}
                      {isDispatched && <Chip tone="warn">bed blocked</Chip>}
                    </div>

                    <p className="mt-1.5 font-mono text-[10px] leading-snug text-mist-500">
                      {match.reason}
                    </p>
                    <p className="mt-1 font-mono text-[9.5px] text-mist-700">
                      straight line {match.straightLineKm} km · detour ×{match.detourFactor} · settled #
                      {match.explorationOrder >= 0 ? match.explorationOrder : "—"}
                    </p>

                    <div className="mt-2">
                      <BedStrip beds={match.hospital.beds} highlight={bedType} compact />
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant={isSuggested ? "primary" : "outline"}
                        disabled={!match.satisfied || reservingId !== null || isDispatched}
                        onClick={() => onReserve(match)}
                      >
                        {isDispatched ? "Blocked" : match.satisfied ? "Block bed" : "No bed"}
                      </Button>
                      <Button size="sm" variant="ghost" icon={<IconRoute className="h-3.5 w-3.5" />} onClick={() => onActiveMatch(match)}>
                        Show route
                      </Button>
                      <Button size="sm" variant="ghost" icon={<IconPhone className="h-3.5 w-3.5" />}>
                        Call
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {exhausted.length > 0 && (
          <p className="mt-2 border-t border-white/5 pt-2 font-mono text-[10px] text-mist-700">
            {exhausted.length} hospital(s) have no khaali {bedShort(bedType)} bed — the min-heap keeps
            them after every hospital that can actually admit.
          </p>
        )}
      </Panel>
    </div>
  );
}
