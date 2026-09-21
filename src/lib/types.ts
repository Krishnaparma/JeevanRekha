export type BedType = "icu" | "ventilator" | "general" | "emergency";
export type Severity = "critical" | "urgent" | "stable";
export type RequestStatus = "reserved" | "dispatched" | "en_route" | "admitted" | "cancelled";
export type NodeKind = "junction" | "locality" | "hospital";
export type EdgeKind = "street" | "avenue" | "expressway" | "bridge";

export interface GraphNodeDto {
  code: string;
  name: string | null;
  district: string | null;
  x: number;
  y: number;
  kind: NodeKind;
}

export interface GraphEdgeDto {
  id: number;
  from: string;
  to: string;
  road: string;
  kind: EdgeKind;
  lanes: number;
  distanceKm: number;
  speedKmh: number;
  congestion: number;
  travelMin: number;
}

export interface RoadGraphDto {
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  river: { x: number; y: number }[];
}

export interface BedInventory {
  icu: { total: number; occupied: number };
  ventilator: { total: number; occupied: number };
  general: { total: number; occupied: number };
  emergency: { total: number; occupied: number };
}

export interface HospitalDto {
  id: number;
  name: string;
  slug: string;
  nodeCode: string;
  nodeName: string | null;
  address: string;
  phone: string;
  traumaLevel: number;
  hasBloodBank: boolean;
  hasNeonatal: boolean;
  specialties: string[];
  rating: number;
  ambulances: number;
  beds: BedInventory;
  updatedAt: string;
}

export interface AlgorithmStats {
  sourceNode: string;
  nodesInGraph: number;
  edgesInGraph: number;
  nodesSettled: number;
  edgeRelaxations: number;
  heapPushes: number;
  heapPops: number;
  heapSwaps: number;
  durationMs: number;
  complexity: string;
}

export interface RouteLeg {
  code: string;
  name: string | null;
  x: number;
  y: number;
}

export interface HospitalMatch {
  rank: number;
  hospital: HospitalDto;
  distanceKm: number;
  etaMinutes: number;
  straightLineKm: number;
  detourFactor: number;
  availableInCategory: number;
  availableTotal: number;
  bedType: BedType;
  satisfied: boolean;
  path: RouteLeg[];
  roads: string[];
  hops: number;
  explorationOrder: number;
  reason: string;
}

export interface RouteResponse {
  ok: boolean;
  from: { code: string; name: string | null; x: number; y: number };
  requestedBedType: BedType;
  severity: Severity;
  matches: HospitalMatch[];
  suggestion: HospitalMatch | null;
  algorithm: AlgorithmStats;
  exploration: { code: string; order: number; distMin: number }[];
  generatedAt: string;
}

export interface BedRequestDto {
  id: number;
  code: string;
  patientName: string;
  patientAge: number;
  severity: Severity;
  bedType: BedType;
  fromNodeCode: string;
  fromLabel: string;
  hospitalId: number;
  hospitalName: string;
  distanceKm: number;
  etaMinutes: number;
  pathCodes: string[];
  roads: string[];
  status: RequestStatus;
  nodesSettled: number;
  heapOps: number;
  createdAt: string;
  updatedAt: string;
}

export interface BedEventDto {
  id: number;
  hospitalId: number;
  hospitalName: string;
  bedType: BedType;
  delta: number;
  reason: string;
  createdAt: string;
}

/** Locality the console opens on, so the first paint already shows a route. */
export const DEFAULT_SOURCE_NAME = "Dhyan Chand Stadium";

export interface ConsoleBootstrap {
  graph: RoadGraphDto;
  hospitals: HospitalDto[];
  requests: BedRequestDto[];
  events: BedEventDto[];
  initialRoute: RouteResponse | null;
  totals: {
    nodes: number;
    edges: number;
    hospitals: number;
    freeBeds: number;
    totalBeds: number;
  };
}

export const BED_TYPES: { id: BedType; label: string; short: string }[] = [
  { id: "icu", label: "ICU bed", short: "ICU" },
  { id: "ventilator", label: "Ventilator bed", short: "VENT" },
  { id: "emergency", label: "Emergency / trauma bay", short: "ER" },
  { id: "general", label: "General ward bed", short: "GEN" },
];

export const SEVERITIES: { id: Severity; label: string; hint: string; bed: BedType }[] = [
  { id: "critical", label: "Critical", hint: "Life threat · needs monitored bed", bed: "ventilator" },
  { id: "urgent", label: "Urgent", hint: "Unstable · needs intensive care", bed: "icu" },
  { id: "stable", label: "Stable", hint: "Conscious · observation is enough", bed: "general" },
];

export function bedLabel(bed: BedType): string {
  return BED_TYPES.find((b) => b.id === bed)?.label ?? bed;
}

export function bedShort(bed: BedType): string {
  return BED_TYPES.find((b) => b.id === bed)?.short ?? bed.toUpperCase();
}

export function severityLabel(severity: Severity): string {
  return SEVERITIES.find((s) => s.id === severity)?.label ?? severity;
}

export function availableBeds(beds: BedInventory, bed: BedType): number {
  const entry = beds[bed];
  return Math.max(0, entry.total - entry.occupied);
}

export function totalAvailableBeds(beds: BedInventory): number {
  return (["icu", "ventilator", "general", "emergency"] as BedType[]).reduce(
    (sum, key) => sum + availableBeds(beds, key),
    0,
  );
}
