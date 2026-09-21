import { db } from "@/db";
import { ensureSeeded } from "@/db/seed";
import { bedEvents, bedRequests, graphEdges, graphNodes, hospitals } from "@/db/schema";
import type { HospitalRow } from "@/db/schema";
import { riverCenterPoints } from "@/lib/city";
import { RoadGraph, rankHospitals } from "@/lib/graph";
import {
  DEFAULT_SOURCE_NAME,
  totalAvailableBeds,
  type BedEventDto,
  type BedInventory,
  type BedRequestDto,
  type BedType,
  type ConsoleBootstrap,
  type GraphEdgeDto,
  type GraphNodeDto,
  type HospitalDto,
  type RequestStatus,
  type RoadGraphDto,
  type RouteResponse,
  type Severity,
} from "@/lib/types";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";

type TotalKey = "icuTotal" | "ventilatorTotal" | "generalTotal" | "emergencyTotal";
type OccupiedKey = "icuOccupied" | "ventilatorOccupied" | "generalOccupied" | "emergencyOccupied";

const BED_KEYS_MAP: Record<BedType, { total: TotalKey; occupied: OccupiedKey }> = {
  icu: { total: "icuTotal", occupied: "icuOccupied" },
  ventilator: { total: "ventilatorTotal", occupied: "ventilatorOccupied" },
  general: { total: "generalTotal", occupied: "generalOccupied" },
  emergency: { total: "emergencyTotal", occupied: "emergencyOccupied" },
};

const BED_KEYS = Object.keys(BED_KEYS_MAP) as BedType[];

function bedsFromRow(row: HospitalRow): BedInventory {
  return {
    icu: { total: row.icuTotal, occupied: row.icuOccupied },
    ventilator: { total: row.ventilatorTotal, occupied: row.ventilatorOccupied },
    general: { total: row.generalTotal, occupied: row.generalOccupied },
    emergency: { total: row.emergencyTotal, occupied: row.emergencyOccupied },
  };
}

function occupiedPatch(bedType: BedType, value: number): Partial<HospitalRow> {
  switch (bedType) {
    case "icu":
      return { icuOccupied: value };
    case "ventilator":
      return { ventilatorOccupied: value };
    case "general":
      return { generalOccupied: value };
    case "emergency":
      return { emergencyOccupied: value };
  }
}

function requestFromRow(row: {
  id: number;
  code: string;
  patientName: string;
  patientAge: number;
  severity: string;
  bedType: string;
  fromNodeCode: string;
  fromLabel: string;
  hospitalId: number;
  hospitalName: string;
  distanceKm: number;
  etaMinutes: number;
  pathCodes: string;
  roads: string;
  status: string;
  nodesSettled: number;
  heapOps: number;
  createdAt: Date;
  updatedAt: Date;
}): BedRequestDto {
  return {
    id: row.id,
    code: row.code,
    patientName: row.patientName,
    patientAge: row.patientAge,
    severity: row.severity as Severity,
    bedType: row.bedType as BedType,
    fromNodeCode: row.fromNodeCode,
    fromLabel: row.fromLabel,
    hospitalId: row.hospitalId,
    hospitalName: row.hospitalName,
    distanceKm: row.distanceKm,
    etaMinutes: row.etaMinutes,
    pathCodes: row.pathCodes.split(",").filter(Boolean),
    roads: row.roads.split("|").filter(Boolean),
    status: row.status as RequestStatus,
    nodesSettled: row.nodesSettled,
    heapOps: row.heapOps,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function loadGraph(): Promise<RoadGraphDto> {
  await ensureSeeded();
  const [nodeRows, edgeRows] = await Promise.all([
    db.select().from(graphNodes).orderBy(asc(graphNodes.id)),
    db.select().from(graphEdges).orderBy(asc(graphEdges.id)),
  ]);

  const nodes: GraphNodeDto[] = nodeRows.map((row) => ({
    code: row.code,
    name: row.name,
    district: row.district,
    x: row.x,
    y: row.y,
    kind: row.kind as GraphNodeDto["kind"],
  }));

  const edges: GraphEdgeDto[] = edgeRows.map((row) => ({
    id: row.id,
    from: row.fromCode,
    to: row.toCode,
    road: row.road,
    kind: row.kind as GraphEdgeDto["kind"],
    lanes: row.lanes,
    distanceKm: row.distanceKm,
    speedKmh: row.speedKmh,
    congestion: row.congestion,
    travelMin: Number(((row.distanceKm / row.speedKmh) * 60 * row.congestion).toFixed(3)),
  }));

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);

  return {
    nodes,
    edges,
    bounds: {
      minX: xs.length ? Math.min(...xs) - 0.7 : 0,
      minY: ys.length ? Math.min(...ys) - 0.7 : 0,
      maxX: xs.length ? Math.max(...xs) + 0.7 : 1,
      maxY: ys.length ? Math.max(...ys) + 0.7 : 1,
    },
    river: riverCenterPoints(),
  };
}

export async function loadHospitals(): Promise<HospitalDto[]> {
  await ensureSeeded();
  const [rows, nodeRows] = await Promise.all([
    db.select().from(hospitals).orderBy(asc(hospitals.name)),
    db.select().from(graphNodes),
  ]);
  const nameByCode = new Map(nodeRows.map((row) => [row.code, row.name] as const));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    nodeCode: row.nodeCode,
    nodeName: nameByCode.get(row.nodeCode) ?? null,
    address: row.address,
    phone: row.phone,
    traumaLevel: row.traumaLevel,
    hasBloodBank: row.hasBloodBank,
    hasNeonatal: row.hasNeonatal,
    specialties: row.specialties
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    rating: row.rating,
    ambulances: row.ambulances,
    beds: bedsFromRow(row),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function loadRequests(limit = 12): Promise<BedRequestDto[]> {
  await ensureSeeded();
  const rows = await db.select().from(bedRequests).orderBy(desc(bedRequests.createdAt)).limit(limit);
  return rows.map(requestFromRow);
}

export async function loadEvents(limit = 14): Promise<BedEventDto[]> {
  await ensureSeeded();
  const rows = await db.select().from(bedEvents).orderBy(desc(bedEvents.id)).limit(limit);
  return rows.map((row) => ({
    id: row.id,
    hospitalId: row.hospitalId,
    hospitalName: row.hospitalName,
    bedType: row.bedType as BedType,
    delta: row.delta,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getConsoleBootstrap(): Promise<ConsoleBootstrap> {
  const [graph, hospitalList, requests, events] = await Promise.all([
    loadGraph(),
    loadHospitals(),
    loadRequests(8),
    loadEvents(12),
  ]);

  // Pre-compute the opening query so the first server-rendered paint already
  // shows the suggested hospital and its highlighted shortest path.
  const source =
    graph.nodes.find((node) => node.name === DEFAULT_SOURCE_NAME) ??
    graph.nodes.find((node) => node.kind === "locality") ??
    graph.nodes[0];
  let initialRoute: RouteResponse | null = null;
  if (source) {
    try {
      initialRoute = await computeRoute({
        fromCode: source.code,
        bedType: "icu",
        severity: "urgent",
      });
    } catch {
      initialRoute = null;
    }
  }

  const totalBeds = hospitalList.reduce(
    (sum, hospital) => sum + BED_KEYS.reduce((inner, key) => inner + hospital.beds[key].total, 0),
    0,
  );
  const freeBeds = hospitalList.reduce((sum, hospital) => sum + totalAvailableBeds(hospital.beds), 0);

  return {
    graph,
    hospitals: hospitalList,
    requests,
    events,
    initialRoute,
    totals: {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      hospitals: hospitalList.length,
      freeBeds,
      totalBeds,
    },
  };
}

export interface RouteInput {
  fromCode: string;
  bedType: BedType;
  severity: Severity;
}

/**
 * Runs the two methods of the project for one query:
 * Dijkstra over the road graph + a priority-queue ranking of hospitals.
 */
export async function computeRoute(input: RouteInput): Promise<RouteResponse> {
  const [graphDto, hospitalList] = await Promise.all([loadGraph(), loadHospitals()]);
  const graph = RoadGraph.build(graphDto.nodes, graphDto.edges);

  if (!graph.has(input.fromCode)) {
    throw new Error(`Unknown location code: ${input.fromCode}`);
  }

  const ranked = rankHospitals(graph, input.fromCode, hospitalList, { bedType: input.bedType });
  const source = graph.nodes.get(input.fromCode) as GraphNodeDto;

  return {
    ok: true,
    from: { code: source.code, name: source.name, x: source.x, y: source.y },
    requestedBedType: input.bedType,
    severity: input.severity,
    matches: ranked.matches,
    suggestion: ranked.suggestion,
    algorithm: {
      sourceNode: input.fromCode,
      nodesInGraph: graph.nodeCount,
      edgesInGraph: graph.edgeCount,
      nodesSettled: ranked.stats.settled,
      edgeRelaxations: ranked.stats.relaxations,
      heapPushes: ranked.stats.heapPushes,
      heapPops: ranked.stats.heapPops,
      heapSwaps: ranked.stats.heapSwaps,
      durationMs: Number(ranked.stats.durationMs.toFixed(3)),
      complexity: "O((V + E) log V) · binary min-heap Dijkstra",
    },
    exploration: ranked.exploration,
    generatedAt: new Date().toISOString(),
  };
}

export interface CreateRequestInput {
  patientName: string;
  patientAge: number;
  severity: Severity;
  bedType: BedType;
  fromCode: string;
  hospitalId: number;
}

/** Reserves a bed, stores the winning path, and writes an audit event. */
export async function createBedRequest(
  input: CreateRequestInput,
): Promise<{ request: BedRequestDto; route: RouteResponse }> {
  await ensureSeeded();
  const route = await computeRoute({
    fromCode: input.fromCode,
    bedType: input.bedType,
    severity: input.severity,
  });

  const match = route.matches.find((m) => m.hospital.id === input.hospitalId);
  if (!match) throw new Error("That hospital is not reachable from the selected location.");
  if (match.availableInCategory <= 0) {
    throw new Error(`No ${input.bedType} bed left at ${match.hospital.name}.`);
  }

  const code = `REQ-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const created = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(hospitals).where(eq(hospitals.id, input.hospitalId));
    if (!row) throw new Error("Hospital not found.");
    const keys = BED_KEYS_MAP[input.bedType];
    const nextOccupied = Math.min(row[keys.total], row[keys.occupied] + 1);

    await tx
      .update(hospitals)
      .set({ ...occupiedPatch(input.bedType, nextOccupied), updatedAt: new Date() })
      .where(eq(hospitals.id, input.hospitalId));

    await tx.insert(bedEvents).values({
      hospitalId: input.hospitalId,
      hospitalName: match.hospital.name,
      bedType: input.bedType,
      delta: -1,
      reason: `Bed blocked for ${input.patientName} · ${code}`,
    });

    const [inserted] = await tx
      .insert(bedRequests)
      .values({
        code,
        patientName: input.patientName,
        patientAge: input.patientAge,
        severity: input.severity,
        bedType: input.bedType,
        fromNodeCode: input.fromCode,
        fromLabel: route.from.name ?? input.fromCode,
        hospitalId: input.hospitalId,
        hospitalName: match.hospital.name,
        distanceKm: match.distanceKm,
        etaMinutes: match.etaMinutes,
        pathCodes: match.path.map((leg) => leg.code).join(","),
        roads: match.roads.join("|"),
        status: "reserved",
        nodesSettled: route.algorithm.nodesSettled,
        heapOps: route.algorithm.heapPushes + route.algorithm.heapPops,
      })
      .returning();

    if (!inserted) throw new Error("Could not create the bed request.");
    return inserted;
  });

  return { request: requestFromRow(created), route };
}

/** Moves a dispatch through reserved → dispatched → en_route → admitted / cancelled. */
export async function updateRequestStatus(
  id: number,
  status: RequestStatus,
): Promise<BedRequestDto | null> {
  await ensureSeeded();
  const [existing] = await db.select().from(bedRequests).where(eq(bedRequests.id, id));
  if (!existing) return null;

  const openStatuses: RequestStatus[] = ["reserved", "dispatched", "en_route"];
  const wasOpen = openStatuses.includes(existing.status as RequestStatus);

  await db.transaction(async (tx) => {
    await tx.update(bedRequests).set({ status, updatedAt: new Date() }).where(eq(bedRequests.id, id));

    if (status === "cancelled" && wasOpen) {
      const [row] = await tx.select().from(hospitals).where(eq(hospitals.id, existing.hospitalId));
      if (row) {
        const bedType = existing.bedType as BedType;
        const keys = BED_KEYS_MAP[bedType];
        const nextOccupied = Math.max(0, row[keys.occupied] - 1);
        await tx
          .update(hospitals)
          .set({ ...occupiedPatch(bedType, nextOccupied), updatedAt: new Date() })
          .where(eq(hospitals.id, existing.hospitalId));
        await tx.insert(bedEvents).values({
          hospitalId: existing.hospitalId,
          hospitalName: existing.hospitalName,
          bedType,
          delta: 1,
          reason: `Bed released · ${existing.code} cancelled`,
        });
      }
    }

    if (status === "admitted") {
      await tx.insert(bedEvents).values({
        hospitalId: existing.hospitalId,
        hospitalName: existing.hospitalName,
        bedType: existing.bedType as BedType,
        delta: 0,
        reason: `${existing.patientName} admitted · ${existing.code} closed`,
      });
    }
  });

  const [row] = await db.select().from(bedRequests).where(eq(bedRequests.id, id));
  return row ? requestFromRow(row) : null;
}

const REASONS_IN = [
  "New admission from casualty ward",
  "108 ambulance brought in a road-accident case",
  "Transferred in from OPD after surgery",
  "Referral admitted from a rural PHC",
];
const REASONS_OUT = [
  "Patient discharged",
  "Shifted to day-care ward",
  "Bed freed after surgery",
  "Discharged under Ayushman Bharat scheme",
];

/**
 * Live-feed tick: nudges occupancy in a few hospitals and congestion on a few
 * road segments, records the deltas, then returns fresh data for the console.
 */
export async function simulateTick(): Promise<{
  hospitals: HospitalDto[];
  events: BedEventDto[];
  changedRoads: number;
  graph: RoadGraphDto;
}> {
  await ensureSeeded();
  const all = await db.select().from(hospitals);
  const picks = [...all].sort(() => Math.random() - 0.5).slice(0, 3);
  const newEvents: {
    hospitalId: number;
    hospitalName: string;
    bedType: string;
    delta: number;
    reason: string;
  }[] = [];

  for (const hospital of picks) {
    const bedType = BED_KEYS[Math.floor(Math.random() * BED_KEYS.length)] as BedType;
    const keys = BED_KEYS_MAP[bedType];
    const total = hospital[keys.total];
    const occupied = hospital[keys.occupied];
    if (total === 0) continue;

    const canAdmit = occupied < total;
    const canDischarge = occupied > 0;
    if (!canAdmit && !canDischarge) continue;
    // Self-balancing feed: the fuller the ward, the more likely a discharge, so
    // a long-running demo keeps a realistic equilibrium instead of filling up.
    const occupancyRatio = total > 0 ? occupied / total : 1;
    const admitProbability = 0.15 + 0.5 * (1 - occupancyRatio);
    const direction =
      canAdmit && canDischarge ? (Math.random() < admitProbability ? 1 : -1) : canAdmit ? 1 : -1;
    const next = Math.max(0, Math.min(total, occupied + direction));
    if (next === occupied) continue;

    await db
      .update(hospitals)
      .set({ ...occupiedPatch(bedType, next), updatedAt: new Date() })
      .where(eq(hospitals.id, hospital.id));

    newEvents.push({
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      bedType,
      delta: direction > 0 ? -1 : 1,
      reason:
        direction > 0
          ? (REASONS_IN[Math.floor(Math.random() * REASONS_IN.length)] as string)
          : (REASONS_OUT[Math.floor(Math.random() * REASONS_OUT.length)] as string),
    });
  }

  const edgeRows = await db.select({ id: graphEdges.id, kind: graphEdges.kind }).from(graphEdges);
  const driftPicks = [...edgeRows].sort(() => Math.random() - 0.5).slice(0, 5);
  for (const edge of driftPicks) {
    const base = edge.kind === "expressway" ? 0.92 : edge.kind === "avenue" ? 1.05 : 1.18;
    const next = Number((base + Math.random() * 0.45).toFixed(2));
    await db
      .update(graphEdges)
      .set({ congestion: next, updatedAt: new Date() })
      .where(eq(graphEdges.id, edge.id));
  }

  if (newEvents.length > 0) await db.insert(bedEvents).values(newEvents);

  const [hospitalList, events, graph] = await Promise.all([
    loadHospitals(),
    loadEvents(12),
    loadGraph(),
  ]);
  return { hospitals: hospitalList, events, changedRoads: driftPicks.length, graph };
}

/** Header statistics for the console. */
export async function networkSummary() {
  await ensureSeeded();
  const rows = await db.select().from(hospitals);
  const freeOf = (row: HospitalRow) =>
    BED_KEYS.reduce(
      (sum, key) => sum + Math.max(0, row[BED_KEYS_MAP[key].total] - row[BED_KEYS_MAP[key].occupied]),
      0,
    );

  const openRequests = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bedRequests)
    .where(inArray(bedRequests.status, ["reserved", "dispatched", "en_route"]));

  return {
    hospitalsWithFreeBeds: rows.filter((row) => freeOf(row) > 0).length,
    hospitalsUnderPressure: rows.filter((row) => freeOf(row) <= 2).length,
    openRequests: openRequests[0]?.count ?? 0,
  };
}
