import { MinHeap, byNumber } from "./priorityQueue";
import {
  availableBeds,
  totalAvailableBeds,
  type BedType,
  type GraphEdgeDto,
  type GraphNodeDto,
  type HospitalDto,
  type HospitalMatch,
  type RouteLeg,
} from "./types";

interface Adjacency {
  to: string;
  edge: GraphEdgeDto;
}

export interface DijkstraResult {
  dist: Map<string, number>;
  prev: Map<string, string>;
  prevEdge: Map<string, GraphEdgeDto>;
  /** node codes in the exact order they were extracted from the priority queue */
  order: string[];
  orderIndex: Map<string, number>;
  settled: number;
  relaxations: number;
  heapPushes: number;
  heapPops: number;
  heapSwaps: number;
  durationMs: number;
}

/**
 * Road network of the city modelled as an undirected weighted graph.
 * Vertices = junctions / localities / hospital gates, edge weight = realistic
 * travel time in minutes (distance ÷ speed × congestion).
 */
export class RoadGraph {
  readonly nodes: Map<string, GraphNodeDto> = new Map();
  readonly adjacency: Map<string, Adjacency[]> = new Map();
  readonly edges: GraphEdgeDto[] = [];

  private constructor(nodes: GraphNodeDto[], edges: GraphEdgeDto[]) {
    for (const node of nodes) {
      this.nodes.set(node.code, node);
      this.adjacency.set(node.code, []);
    }
    for (const edge of edges) {
      this.edges.push(edge);
      const forward = this.adjacency.get(edge.from);
      const backward = this.adjacency.get(edge.to);
      if (!forward || !backward) continue;
      forward.push({ to: edge.to, edge });
      backward.push({ to: edge.from, edge });
    }
  }

  static build(nodes: GraphNodeDto[], edges: GraphEdgeDto[]): RoadGraph {
    return new RoadGraph(nodes, edges);
  }

  get nodeCount(): number {
    return this.nodes.size;
  }

  get edgeCount(): number {
    return this.edges.length;
  }

  has(code: string): boolean {
    return this.nodes.has(code);
  }

  neighbors(code: string): Adjacency[] {
    return this.adjacency.get(code) ?? [];
  }

  /** Nearest vertex to a free-form point (used when a pin is dropped on the map). */
  nearestNodeTo(x: number, y: number): GraphNodeDto | null {
    let best: GraphNodeDto | null = null;
    let bestDist = Infinity;
    for (const node of this.nodes.values()) {
      const d = (node.x - x) ** 2 + (node.y - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = node;
      }
    }
    return best;
  }

  /**
   * Single-source shortest path with a binary min-heap priority queue.
   * Lazy deletion: a stale queue entry is skipped when its key is worse than
   * the already recorded distance.
   */
  dijkstra(source: string): DijkstraResult {
    const started = performance.now();
    const dist = new Map<string, number>();
    const prev = new Map<string, string>();
    const prevEdge = new Map<string, GraphEdgeDto>();
    const order: string[] = [];
    const orderIndex = new Map<string, number>();
    const seen = new Set<string>();
    let relaxations = 0;

    if (!this.nodes.has(source)) {
      return {
        dist,
        prev,
        prevEdge,
        order,
        orderIndex,
        settled: 0,
        relaxations: 0,
        heapPushes: 0,
        heapPops: 0,
        heapSwaps: 0,
        durationMs: performance.now() - started,
      };
    }

    const pq = new MinHeap<{ code: string; key: number }>((a, b) => byNumber(a.key, b.key));
    dist.set(source, 0);
    pq.push({ code: source, key: 0 });

    while (!pq.isEmpty()) {
      const current = pq.pop() as { code: string; key: number };
      const best = dist.get(current.code);
      if (best === undefined || current.key > best + 1e-9) continue; // stale entry
      if (seen.has(current.code)) continue;
      seen.add(current.code);
      orderIndex.set(current.code, order.length);
      order.push(current.code);

      for (const { to, edge } of this.neighbors(current.code)) {
        if (seen.has(to)) continue;
        relaxations += 1;
        const candidate = best + edge.travelMin;
        const known = dist.get(to);
        if (known === undefined || candidate + 1e-9 < known) {
          dist.set(to, candidate);
          prev.set(to, current.code);
          prevEdge.set(to, edge);
          pq.push({ code: to, key: candidate });
        }
      }
    }

    return {
      dist,
      prev,
      prevEdge,
      order,
      orderIndex,
      settled: order.length,
      relaxations,
      heapPushes: pq.pushes,
      heapPops: pq.pops,
      heapSwaps: pq.swaps,
      durationMs: performance.now() - started,
    };
  }

  /** Reconstructs the vertex sequence from `source` to `target`. */
  pathCodes(source: string, target: string, result: DijkstraResult): string[] {
    if (!result.dist.has(target)) return [];
    const path: string[] = [target];
    let cursor = target;
    let guard = 0;
    while (cursor !== source && guard++ < 5000) {
      const parent = result.prev.get(cursor);
      if (!parent) break;
      path.push(parent);
      cursor = parent;
    }
    return path.reverse();
  }

  pathLegs(codes: string[]): RouteLeg[] {
    return codes
      .map((code) => this.nodes.get(code))
      .filter((node): node is GraphNodeDto => Boolean(node))
      .map((node) => ({ code: node.code, name: node.name, x: node.x, y: node.y }));
  }

  /**
   * Road distance (km) along a vertex sequence. When the Dijkstra result is
   * supplied the real segment lengths are used (they include the road-factor of
   * each street), otherwise straight-line distance is used as a fallback.
   */
  pathDistance(codes: string[], result?: DijkstraResult): number {
    let km = 0;
    for (let i = 1; i < codes.length; i += 1) {
      const code = codes[i] as string;
      if (result) {
        const edge = result.prevEdge.get(code);
        if (edge) {
          km += edge.distanceKm;
          continue;
        }
      }
      const a = this.nodes.get(codes[i - 1] as string);
      const b = this.nodes.get(code);
      if (!a || !b) continue;
      km += Math.hypot(a.x - b.x, a.y - b.y);
    }
    return km;
  }

  roadNames(codes: string[], result: DijkstraResult): string[] {
    const names: string[] = [];
    for (let i = 1; i < codes.length; i += 1) {
      const edge = result.prevEdge.get(codes[i] as string);
      const name = edge?.road ?? "Connecting road";
      if (names[names.length - 1] !== name) names.push(name);
    }
    return names;
  }
}

function haversineLikeKm(a: GraphNodeDto, b: GraphNodeDto): number {
  // The city model uses a planar km coordinate system.
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export interface RankOptions {
  bedType: BedType;
  limit?: number;
}

export interface RankResult {
  matches: HospitalMatch[];
  suggestion: HospitalMatch | null;
  stats: {
    settled: number;
    relaxations: number;
    heapPushes: number;
    heapPops: number;
    heapSwaps: number;
    durationMs: number;
    candidatesQueued: number;
  };
  exploration: { code: string; order: number; distMin: number }[];
}

/**
 * Ranks every reachable hospital for a patient located at `sourceCode`.
 *
 * Step 1 – Dijkstra from the user's vertex (priority queue on travel time).
 * Step 2 – every hospital with a free bed of the requested type is pushed into
 *          a second priority queue keyed by (ETA, distance, fewer beds first).
 * Step 3 – the queue is drained, so the first pop is the recommended hospital
 *          and the rest form the ranked fallback list.
 */
export function rankHospitals(
  graph: RoadGraph,
  sourceCode: string,
  hospitals: HospitalDto[],
  options: RankOptions,
): RankResult {
  const started = performance.now();
  const result = graph.dijkstra(sourceCode);
  const source = graph.nodes.get(sourceCode);

  interface Candidate {
    hospital: HospitalDto;
    eta: number;
    km: number;
    freeInCategory: number;
    freeTotal: number;
    satisfied: boolean;
  }

  const pq = new MinHeap<Candidate>((a, b) => {
    // Hospitals that satisfy the requested bed type always win…
    const satisfiedDelta = Number(b.satisfied) - Number(a.satisfied);
    if (satisfiedDelta !== 0) return satisfiedDelta;
    // …then shortest travel time (Dijkstra guarantee)…
    const etaDelta = byNumber(a.eta, b.eta);
    if (etaDelta !== 0) return etaDelta;
    // …then shorter road distance, then more spare capacity as a tie-break.
    const kmDelta = byNumber(a.km, b.km);
    if (kmDelta !== 0) return kmDelta;
    return byNumber(b.freeInCategory, a.freeInCategory);
  });

  for (const hospital of hospitals) {
    const eta = result.dist.get(hospital.nodeCode);
    if (eta === undefined || !source) continue;
    const node = graph.nodes.get(hospital.nodeCode);
    if (!node) continue;
    const freeInCategory = availableBeds(hospital.beds, options.bedType);
    const codesToHospital = graph.pathCodes(sourceCode, hospital.nodeCode, result);
    const km = graph.pathDistance(codesToHospital, result);
    pq.push({
      hospital,
      eta,
      km: km || haversineLikeKm(source, node),
      freeInCategory,
      freeTotal: totalAvailableBeds(hospital.beds),
      satisfied: freeInCategory > 0,
    });
  }

  const candidatesQueued = pq.size;
  const drained = pq.drain();
  const limit = options.limit ?? drained.length;

  const matches: HospitalMatch[] = drained.slice(0, limit).map((candidate, index) => {
    const codes = graph.pathCodes(sourceCode, candidate.hospital.nodeCode, result);
    const legs = graph.pathLegs(codes);
    const node = graph.nodes.get(candidate.hospital.nodeCode);
    const straight = node && source ? haversineLikeKm(source, node) : candidate.km;
    const explorationOrder = result.orderIndex.get(candidate.hospital.nodeCode) ?? -1;
    const rank = index + 1;

    let reason: string;
    if (!candidate.satisfied && candidate.freeTotal === 0) {
      reason = "Fully occupied — kept in the list for visibility, no bed of any type.";
    } else if (!candidate.satisfied) {
      reason = `No ${options.bedType.toUpperCase()} bed free right now, but ${candidate.freeTotal} other bed(s) are available.`;
    } else if (rank === 1) {
      reason = `Nearest reachable hospital with a free ${options.bedType.toUpperCase()} bed — ${candidate.freeInCategory} spare.`;
    } else {
      reason = `Reachable in ${candidate.eta.toFixed(1)} min with ${candidate.freeInCategory} free ${options.bedType.toUpperCase()} bed(s).`;
    }

    return {
      rank,
      hospital: candidate.hospital,
      distanceKm: Number(candidate.km.toFixed(2)),
      etaMinutes: Number(candidate.eta.toFixed(1)),
      straightLineKm: Number(straight.toFixed(2)),
      detourFactor: straight > 0 ? Number((candidate.km / straight).toFixed(2)) : 1,
      availableInCategory: candidate.freeInCategory,
      availableTotal: candidate.freeTotal,
      bedType: options.bedType,
      satisfied: candidate.satisfied,
      path: legs,
      roads: graph.roadNames(codes, result),
      hops: Math.max(0, codes.length - 1),
      explorationOrder,
      reason,
    };
  });

  return {
    matches,
    suggestion: matches.find((m) => m.satisfied) ?? null,
    stats: {
      settled: result.settled,
      relaxations: result.relaxations,
      heapPushes: result.heapPushes + pq.pushes,
      heapPops: result.heapPops + pq.pops,
      heapSwaps: result.heapSwaps + pq.swaps,
      durationMs: performance.now() - started,
      candidatesQueued,
    },
    exploration: result.order.map((code, order) => ({
      code,
      order,
      distMin: Number((result.dist.get(code) ?? 0).toFixed(2)),
    })),
  };
}
