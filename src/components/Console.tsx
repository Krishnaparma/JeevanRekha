"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DispatchPanel, { ActivityFeed } from "@/components/DispatchPanel";
import CityMap from "@/components/CityMap";
import LocationPanel from "@/components/LocationPanel";
import ResultsPanel from "@/components/ResultsPanel";
import {
  Button,
  Chip,
  IconCross,
  IconGraph,
  IconHeap,
  IconPhone,
  IconPulse,
  IconRefresh,
} from "@/components/ui";
import {
  BED_TYPES,
  DEFAULT_SOURCE_NAME,
  totalAvailableBeds,
  type BedEventDto,
  type BedRequestDto,
  type BedType,
  type ConsoleBootstrap,
  type HospitalMatch,
  type RequestStatus,
  type RoadGraphDto,
  type RouteResponse,
  type Severity,
  type HospitalDto,
} from "@/lib/types";

interface ConsoleProps {
  bootstrap: ConsoleBootstrap;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await response.json()) as { ok: boolean; data?: T; error?: string };
  if (!json.ok || json.data === undefined) {
    throw new Error(json.error ?? `Request to ${url} failed`);
  }
  return json.data;
}

export default function Console({ bootstrap }: ConsoleProps) {
  const [graph, setGraph] = useState<RoadGraphDto>(bootstrap.graph);
  const [hospitals, setHospitals] = useState<HospitalDto[]>(bootstrap.hospitals);
  const [requests, setRequests] = useState<BedRequestDto[]>(bootstrap.requests);
  const [events, setEvents] = useState<BedEventDto[]>(bootstrap.events);

  const [fromCode, setFromCode] = useState<string>(
    () =>
      bootstrap.initialRoute?.from.code ??
      bootstrap.graph.nodes.find((node) => node.name === DEFAULT_SOURCE_NAME)?.code ??
      bootstrap.graph.nodes.find((node) => node.kind === "locality")?.code ??
      bootstrap.graph.nodes[0]?.code ??
      "",
  );
  const [patientName, setPatientName] = useState("Aarav Sharma");
  const [patientAge, setPatientAge] = useState(34);
  const [severity, setSeverity] = useState<Severity>("urgent");
  const [bedType, setBedType] = useState<BedType>("icu");

  const [route, setRoute] = useState<RouteResponse | null>(bootstrap.initialRoute);
  const [activeMatchId, setActiveMatchId] = useState<number | null>(
    bootstrap.initialRoute?.suggestion?.hospital.id ?? null,
  );
  const [searching, setSearching] = useState(false);
  const [reservingId, setReservingId] = useState<number | null>(null);
  const [dispatch, setDispatch] = useState<BedRequestDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showExploration, setShowExploration] = useState(false);
  const [live, setLive] = useState(true);
  const [clock, setClock] = useState("--:--:--");
  const mounted = useRef(false);

  // Fallback: if the seeded graph arrives without a chosen location, take the
  // first named locality so the console always has a source vertex.
  useEffect(() => {
    if (fromCode || graph.nodes.length === 0) return;
    const fallback = graph.nodes.find((node) => node.kind === "locality") ?? graph.nodes[0];
    if (fallback) setFromCode(fallback.code);
  }, [fromCode, graph.nodes]);

  useEffect(() => {
    mounted.current = true;
    const id = setInterval(() => {
      setClock(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 4200);
    return () => clearTimeout(id);
  }, [notice]);

  const runSearch = useCallback(
    async (options?: { silent?: boolean; code?: string; keepMatch?: number | null }) => {
      const source = options?.code ?? fromCode;
      if (!source) return;
      if (!options?.silent) setSearching(true);
      setError(null);
      try {
        const data = await postJson<RouteResponse>("/api/route", {
          fromCode: source,
          bedType,
          severity,
        });
        setRoute(data);
        const keep = options?.keepMatch ?? activeMatchId;
        const stillValid = keep !== null && data.matches.some((m) => m.hospital.id === keep);
        setActiveMatchId(stillValid ? keep : (data.suggestion?.hospital.id ?? null));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Routing failed");
      } finally {
        setSearching(false);
      }
    },
    [fromCode, bedType, severity, activeMatchId],
  );

  // Recompute whenever the patient location or the clinical requirement changes.
  useEffect(() => {
    void runSearch({ silent: mounted.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCode, bedType, severity]);

  const refreshSnapshot = useCallback(async () => {
    try {
      const [snapshot, requestList] = await Promise.all([
        postJson<{ hospitals: HospitalDto[]; events: BedEventDto[]; graph: RoadGraphDto }>("/api/simulate"),
        postJson<BedRequestDto[]>("/api/requests"),
      ]);
      setHospitals(snapshot.hospitals);
      setEvents(snapshot.events);
      setGraph(snapshot.graph);
      setRequests(requestList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh the live board");
    }
  }, []);

  const tick = useCallback(async () => {
    try {
      const snapshot = await postJson<{
        hospitals: HospitalDto[];
        events: BedEventDto[];
        graph: RoadGraphDto;
        changedRoads: number;
      }>("/api/simulate", {});
      setHospitals(snapshot.hospitals);
      setEvents(snapshot.events);
      setGraph(snapshot.graph);
      await runSearch({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Live feed tick failed");
    }
  }, [runSearch]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      void tick();
    }, 9000);
    return () => clearInterval(id);
  }, [live, tick]);

  const reserve = useCallback(
    async (match: HospitalMatch) => {
      if (!patientName.trim()) {
        setError("Enter the patient name before reserving a bed.");
        return;
      }
      setReservingId(match.hospital.id);
      setError(null);
      try {
        const result = await postJson<{ request: BedRequestDto; route: RouteResponse }>("/api/requests", {
          patientName: patientName.trim(),
          patientAge: Number.isFinite(patientAge) ? patientAge : 0,
          severity,
          bedType,
          fromCode,
          hospitalId: match.hospital.id,
        });
        setDispatch(result.request);
        setNotice(`Bed blocked at ${result.request.hospitalName} · ${result.request.code}`);
        await refreshSnapshot();
        await runSearch({ silent: true, keepMatch: match.hospital.id });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not reserve the bed");
      } finally {
        setReservingId(null);
      }
    },
    [patientName, patientAge, severity, bedType, fromCode, refreshSnapshot, runSearch],
  );

  const advance = useCallback(
    async (status: RequestStatus) => {
      if (!dispatch) return;
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(`/api/requests/${dispatch.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
          cache: "no-store",
        });
        const json = (await response.json()) as { ok: boolean; data?: BedRequestDto; error?: string };
        if (!json.ok || !json.data) throw new Error(json.error ?? "Could not update the dispatch");
        setDispatch(json.data);
        setNotice(
          status === "cancelled"
            ? `${json.data.code} released — the bed is back in the pool`
            : `${json.data.code} → ${status.replace("_", " ")}`,
        );
        await refreshSnapshot();
        await runSearch({ silent: true, keepMatch: dispatch.hospitalId });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update the dispatch");
      } finally {
        setBusy(false);
      }
    },
    [dispatch, refreshSnapshot, runSearch],
  );

  const replay = useCallback(
    (request: BedRequestDto) => {
      setDispatch(request);
      setSeverity(request.severity);
      setBedType(request.bedType);
      setFromCode(request.fromNodeCode);
      setPatientName(request.patientName);
      setPatientAge(request.patientAge);
      void runSearch({ silent: true, code: request.fromNodeCode, keepMatch: request.hospitalId });
    },
    [runSearch],
  );

  const reset = useCallback(async () => {
    setBusy(true);
    try {
      const data = await postJson<ConsoleBootstrap>("/api/reset", {});
      setGraph(data.graph);
      setHospitals(data.hospitals);
      setRequests(data.requests);
      setEvents(data.events);
      setDispatch(null);
      setRoute(data.initialRoute);
      setActiveMatchId(data.initialRoute?.suggestion?.hospital.id ?? null);
      setNotice("City restored to the seeded baseline");
      await runSearch({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }, [runSearch]);

  const totals = useMemo(() => {
    const totalBeds = hospitals.reduce(
      (sum, hospital) => sum + BED_TYPES.reduce((inner, bed) => inner + hospital.beds[bed.id].total, 0),
      0,
    );
    const freeBeds = hospitals.reduce((sum, hospital) => sum + totalAvailableBeds(hospital.beds), 0);
    const withCapacity = hospitals.filter((hospital) => totalAvailableBeds(hospital.beds) > 0).length;
    const openRequests = requests.filter((request) =>
      ["reserved", "dispatched", "en_route"].includes(request.status),
    ).length;
    return { totalBeds, freeBeds, withCapacity, openRequests };
  }, [hospitals, requests]);

  const activeMatch = useMemo(
    () => route?.matches.find((match) => match.hospital.id === activeMatchId) ?? null,
    [route, activeMatchId],
  );

  const dispatchOverlay = useMemo(() => {
    if (!dispatch) return null;
    return {
      pathCodes: dispatch.pathCodes,
      status: dispatch.status,
      hospitalName: dispatch.hospitalName,
      etaMinutes: dispatch.etaMinutes,
    };
  }, [dispatch]);

  const fromLabel = graph.nodes.find((node) => node.code === fromCode)?.name ?? fromCode;

  return (
    <div className="min-h-screen">
      {/* ------------------------------------------------------------ header */}
      <header className="sticky top-0 z-30 border-b border-white/8 bg-night-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-critical-400/40 bg-critical-500/15 text-critical-300">
              <IconCross className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-critical-400 blink" />
            </span>
            <div>
              <h1 className="text-[15px] font-bold leading-none tracking-[0.16em] text-mist-100">
                JEEVAN<span className="text-critical-400">REKHA</span>
              </h1>
              <p className="mt-1 font-mono text-[10px] leading-none text-mist-500">
                Suryanagar 108 emergency bed network · graph + priority queue
              </p>
            </div>
            <span className="hidden items-center gap-1.5 rounded-lg border border-critical-400/40 bg-critical-500/10 px-2 py-1 sm:flex">
              <IconPhone className="h-3.5 w-3.5 text-critical-300" />
              <span className="font-mono text-[13px] font-bold leading-none text-critical-300">108</span>
            </span>
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Chip tone="good">
              <span className="font-mono">{totals.freeBeds}</span> beds free
            </Chip>
            <Chip tone={totals.withCapacity === hospitals.length ? "good" : "warn"}>
              {totals.withCapacity}/{hospitals.length} hospitals with capacity
            </Chip>
            <Chip tone={totals.openRequests > 0 ? "warn" : "neutral"}>
              {totals.openRequests} open dispatch{totals.openRequests === 1 ? "" : "es"}
            </Chip>
            <Chip tone="info">
              <IconGraph className="h-3 w-3" />
              {graph.nodes.length} vertices · {graph.edges.length} edges
            </Chip>
            <Chip tone="neutral">
              <IconHeap className="h-3 w-3" />
              {route ? `${route.algorithm.heapPushes + route.algorithm.heapPops} heap ops` : "min-heap ready"}
            </Chip>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <div className="font-mono text-[13px] leading-none text-mist-100">{clock}</div>
              <div className="mt-1 font-mono text-[9px] leading-none text-mist-700">
                {live ? "live feed on · tick 9s" : "live feed paused"}
              </div>
            </div>
            <Button
              size="sm"
              variant={live ? "primary" : "outline"}
              icon={<IconPulse className="h-3.5 w-3.5" />}
              onClick={() => setLive((value) => !value)}
            >
              {live ? "Live" : "Paused"}
            </Button>
            <Button size="sm" variant="outline" icon={<IconRefresh className="h-3.5 w-3.5" />} onClick={() => void tick()}>
              Tick
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void reset()} disabled={busy}>
              Reset city
            </Button>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------- body */}
      <main className="mx-auto grid max-w-[1800px] grid-cols-1 gap-4 px-3 py-4 sm:px-4 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)_minmax(340px,400px)]">
        <div className="order-1 space-y-4 xl:col-start-1 xl:row-start-1">
          <LocationPanel
            nodes={graph.nodes}
            fromCode={fromCode}
            onFromCode={setFromCode}
            patientName={patientName}
            onPatientName={setPatientName}
            patientAge={patientAge}
            onPatientAge={setPatientAge}
            severity={severity}
            onSeverity={setSeverity}
            bedType={bedType}
            onBedType={setBedType}
            onSearch={() => void runSearch()}
            searching={searching}
            showExploration={showExploration}
            onShowExploration={setShowExploration}
            algorithm={route?.algorithm ?? null}
          />
        </div>

        <div className="order-2 space-y-4 xl:col-start-2 xl:row-start-1">
          <div className="panel rounded-xl p-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
              <div>
                <div className="label-caps text-signal-400">Suryanagar · live road graph</div>
                <h2 className="text-[13px] font-semibold text-mist-100">
                  Patient at {fromLabel || "—"}
                  {route?.suggestion && (
                    <span className="ml-2 font-mono text-[11px] text-signal-300">
                      → {route.suggestion.hospital.name} · {route.suggestion.etaMinutes} min ·{" "}
                      {route.suggestion.distanceKm} km
                    </span>
                  )}
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                {searching && <Chip tone="info">dijkstra running…</Chip>}
                {activeMatch && <Chip tone="good">rank #{activeMatch.rank} route shown</Chip>}
                <Button size="sm" variant="ghost" onClick={() => setShowExploration((v) => !v)}>
                  {showExploration ? "hide" : "show"} exploration
                </Button>
              </div>
            </div>
            <CityMap
              graph={graph}
              hospitals={hospitals}
              fromCode={fromCode || null}
              bedType={bedType}
              route={route}
              activeMatch={activeMatch}
              dispatch={dispatchOverlay}
              showExploration={showExploration}
              onSelectNode={(code) => setFromCode(code)}
              onSelectHospital={(id) => {
                const match = route?.matches.find((m) => m.hospital.id === id);
                if (match) setActiveMatchId(id);
              }}
            />
          </div>
        </div>

        <div className="order-3 space-y-4 xl:col-start-3 xl:row-start-1">
          <DispatchPanel
            dispatch={dispatch}
            onAdvance={(status) => void advance(status)}
            onCancel={() => void advance("cancelled")}
            busy={busy}
          />
          <ResultsPanel
            route={route}
            bedType={bedType}
            activeMatchId={activeMatchId}
            onActiveMatch={(match) => setActiveMatchId(match?.hospital.id ?? null)}
            onReserve={(match) => void reserve(match)}
            reservingId={reservingId}
            searching={searching}
            error={error}
            dispatchHospitalId={dispatch?.hospitalId ?? null}
          />
        </div>

        <div className="order-4 xl:col-span-3 xl:row-start-2">
          <ActivityFeed requests={requests} events={events} onReplay={replay} />
        </div>
      </main>

      {/* ------------------------------------------------------------ footer */}
      <footer className="mx-auto max-w-[1800px] px-4 pb-10">
        <div className="panel grid gap-4 rounded-xl p-4 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <IconGraph className="h-4 w-4 text-signal-400" />
              <h3 className="text-[12px] font-semibold tracking-wide text-mist-100">Method 1 · Graph</h3>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-mist-500">
              Suryanagar is stored as an adjacency list: {graph.nodes.length} vertices (chowks,
              localities, hospital gates) and {graph.edges.length} undirected road segments. Each edge
              weight is real travel time — distance ÷ speed limit × live traffic — so the Chandrabhaga
              river, the two setus and the suburban railway line all change the answer.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <IconHeap className="h-4 w-4 text-alert-400" />
              <h3 className="text-[12px] font-semibold tracking-wide text-mist-100">
                Method 2 · Priority queue
              </h3>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-mist-500">
              A binary min-heap is used twice. First as Dijkstra&apos;s fringe, keyed by tentative travel
              time ({route ? `${route.algorithm.heapPushes} pushes` : "O(log V) per operation"}). Second as the
              hospital ranking queue keyed by (has a free bed, ETA, distance), so the first pop is always
              the nearest hospital that can actually take the patient.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <IconPulse className="h-4 w-4 text-critical-400" />
              <h3 className="text-[12px] font-semibold tracking-wide text-mist-100">Flow</h3>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-mist-500">
              Choose your locality → Dijkstra sweeps the graph → hospitals with khaali beds of the
              requested category are ranked → the nearest is suggested with its road-by-road route →
              reserving writes the dispatch (path included) to PostgreSQL, blocks the bed and sends the
              108 ambulance along the computed path.
            </p>
          </div>
        </div>
        <p className="mt-3 text-center font-mono text-[10px] text-mist-700">
          JeevanRekha · Suryanagar Nagar Nigam health cell demo · Next.js App Router · PostgreSQL via
          Drizzle ORM · bed occupancy updates every 9 seconds
        </p>
      </footer>

      {notice && (
        <div className="rise-in fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-signal-400/40 bg-night-900/95 px-4 py-2.5 text-[12px] font-semibold text-signal-300 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          {notice}
        </div>
      )}
    </div>
  );
}
