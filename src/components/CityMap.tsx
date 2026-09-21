"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  availableBeds,
  type BedType,
  type GraphEdgeDto,
  type HospitalDto,
  type HospitalMatch,
  type RequestStatus,
  type RoadGraphDto,
  type RouteResponse,
} from "@/lib/types";
import { bedTone } from "./ui";

const SCALE = 56; // px per km inside the viewBox
const PAD = 30;

interface DispatchOverlay {
  pathCodes: string[];
  status: RequestStatus;
  hospitalName: string;
  etaMinutes: number;
}

interface CityMapProps {
  graph: RoadGraphDto;
  hospitals: HospitalDto[];
  fromCode: string | null;
  bedType: BedType;
  route: RouteResponse | null;
  activeMatch: HospitalMatch | null;
  dispatch: DispatchOverlay | null;
  showExploration: boolean;
  onSelectNode: (code: string) => void;
  onSelectHospital: (hospitalId: number) => void;
}

const EDGE_STYLE: Record<GraphEdgeDto["kind"], { stroke: string; width: number; dash?: string }> = {
  street: { stroke: "#26344f", width: 3.4 },
  avenue: { stroke: "#31456b", width: 5 },
  expressway: { stroke: "#3f5f96", width: 7.5 },
  bridge: { stroke: "#4c74ad", width: 5.4 },
};

const STATUS_COLOR: Record<RequestStatus, string> = {
  reserved: "#ffb443",
  dispatched: "#ffb443",
  en_route: "#2ee0c2",
  admitted: "#6ff2dc",
  cancelled: "#ff5f6d",
};

function pointAt(points: { x: number; y: number }[], t: number) {
  if (points.length === 0) return { x: 0, y: 0, angle: 0 };
  if (points.length === 1) return { ...points[0], angle: 0 };
  const segments: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1] as { x: number; y: number };
    const next = points[i] as { x: number; y: number };
    const len = Math.hypot(next.x - prev.x, next.y - prev.y);
    segments.push(len);
    total += len;
  }
  if (total === 0) return { ...points[0], angle: 0 };
  const target = Math.min(Math.max(t, 0), 1) * total;
  let walked = 0;
  for (let i = 0; i < segments.length; i += 1) {
    const len = segments[i] as number;
    if (walked + len >= target) {
      const ratio = len === 0 ? 0 : (target - walked) / len;
      const a = points[i] as { x: number; y: number };
      const b = points[i + 1] as { x: number; y: number };
      return {
        x: a.x + (b.x - a.x) * ratio,
        y: a.y + (b.y - a.y) * ratio,
        angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
      };
    }
    walked += len;
  }
  const last = points[points.length - 1] as { x: number; y: number };
  return { ...last, angle: 0 };
}

export default function CityMap({
  graph,
  hospitals,
  fromCode,
  bedType,
  route,
  activeMatch,
  dispatch,
  showExploration,
  onSelectNode,
  onSelectHospital,
}: CityMapProps) {
  const [hover, setHover] = useState<{ kind: "node" | "hospital"; label: string; detail: string } | null>(
    null,
  );
  const ambulanceRef = useRef<SVGGElement | null>(null);
  const etaRef = useRef<SVGTextElement | null>(null);

  const geometry = useMemo(() => {
    const { minX, minY, maxX, maxY } = graph.bounds;
    const width = (maxX - minX) * SCALE + PAD * 2;
    const height = (maxY - minY) * SCALE + PAD * 2;
    const toPx = (x: number, y: number) => ({
      x: (x - minX) * SCALE + PAD,
      y: (y - minY) * SCALE + PAD,
    });
    return { width, height, toPx, minX, minY };
  }, [graph.bounds]);

  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.code, node] as const)),
    [graph.nodes],
  );

  const explorationByCode = useMemo(
    () => new Map((route?.exploration ?? []).map((e) => [e.code, e] as const)),
    [route],
  );

  const pathByHospital = useMemo(() => {
    const map = new Map<number, HospitalMatch>();
    for (const match of route?.matches ?? []) map.set(match.hospital.id, match);
    return map;
  }, [route]);

  /** The polyline currently drawn on top of the network. */
  const highlighted: { points: { x: number; y: number }[]; color: string; label: string } | null =
    useMemo(() => {
      const codes: string[] | null = dispatch
        ? dispatch.pathCodes
        : (activeMatch?.path.map((leg) => leg.code) ?? route?.suggestion?.path.map((leg) => leg.code) ?? null);
      if (!codes || codes.length < 2) return null;
      const points = codes
        .map((code) => nodeById.get(code))
        .filter((node): node is NonNullable<typeof node> => Boolean(node))
        .map((node) => geometry.toPx(node.x, node.y));
      const color = dispatch
        ? (STATUS_COLOR[dispatch.status] ?? "#2ee0c2")
        : "#2ee0c2";
      const label = dispatch ? dispatch.hospitalName : (activeMatch?.hospital.name ?? route?.suggestion?.hospital.name ?? "");
      return { points, color, label };
    }, [dispatch, activeMatch, route, nodeById, geometry]);

  // Ambulance animation (imperative: keeps the map from re-rendering 60×/s).
  useEffect(() => {
    const el = ambulanceRef.current;
    if (!el) return;
    const moving = dispatch && (dispatch.status === "dispatched" || dispatch.status === "en_route");
    if (!moving || !highlighted) {
      el.setAttribute("opacity", "0");
      return;
    }
    el.setAttribute("opacity", "1");
    const duration = Math.max(4200, Math.min(16000, dispatch.etaMinutes * 900));
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = ((now - start) % duration) / duration;
      const pos = pointAt(highlighted.points, t);
      el.setAttribute("transform", `translate(${pos.x} ${pos.y}) rotate(${pos.angle})`);
      if (etaRef.current) {
        etaRef.current.textContent = `${Math.max(1, Math.round(dispatch.etaMinutes * (1 - t)))} min`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dispatch, highlighted]);

  const riverPath = useMemo(() => {
    const pts = graph.river.map((p) => geometry.toPx(p.x, p.y));
    if (pts.length === 0) return "";
    return `M ${pts.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
  }, [graph.river, geometry]);

  const railwayY = geometry.toPx(0, 0.9 + 2 * 1.8 + 0.9).y;
  const fromNode = fromCode ? nodeById.get(fromCode) : undefined;
  const hospitalByNode = useMemo(
    () => new Map(hospitals.map((h) => [h.nodeCode, h] as const)),
    [hospitals],
  );

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/8 bg-night-950">
      {/* On phones the SVG keeps a minimum width and the container pans sideways,
          so labels stay readable instead of shrinking to nothing. */}
      <div className="thin-scroll overflow-x-auto overscroll-x-contain">
        <div className="min-w-[680px] lg:min-w-0">
      <svg
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        className="block h-auto w-full select-none"
        role="img"
        aria-label="Road network graph of Suryanagar"
      >
        <defs>
          <pattern id="map-grid" width="34" height="34" patternUnits="userSpaceOnUse">
            <path d="M34 0H0V34" fill="none" stroke="rgba(96,128,190,0.09)" strokeWidth="1" />
          </pattern>
          <radialGradient id="map-vignette" cx="50%" cy="45%" r="72%">
            <stop offset="55%" stopColor="rgba(6,10,20,0)" />
            <stop offset="100%" stopColor="rgba(3,5,11,0.9)" />
          </radialGradient>
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="river-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d2b4a" />
            <stop offset="100%" stopColor="#113a5f" />
          </linearGradient>
        </defs>

        <rect width={geometry.width} height={geometry.height} fill="#060a13" />
        <rect width={geometry.width} height={geometry.height} fill="url(#map-grid)" />

        {/* river */}
        <path d={riverPath} fill="none" stroke="url(#river-grad)" strokeWidth={28} strokeLinecap="round" opacity={0.95} />
        <path d={riverPath} fill="none" stroke="#1b5480" strokeWidth={2} opacity={0.5} strokeLinecap="round" />

        {/* railway cutting */}
        <g opacity={0.65}>
          <rect x={PAD * 0.4} y={railwayY - 7} width={geometry.width - PAD * 0.8} height={14} fill="#0a0f1c" />
          <line
            x1={PAD * 0.4}
            y1={railwayY}
            x2={geometry.width - PAD * 0.4}
            y2={railwayY}
            stroke="#3a4a6e"
            strokeWidth={2}
            strokeDasharray="10 8"
          />
        </g>

        {/* road network (graph edges) */}
        <g strokeLinecap="round">
          {graph.edges.map((edge) => {
            const a = nodeById.get(edge.from);
            const b = nodeById.get(edge.to);
            if (!a || !b) return null;
            const pa = geometry.toPx(a.x, a.y);
            const pb = geometry.toPx(b.x, b.y);
            const style = EDGE_STYLE[edge.kind] ?? EDGE_STYLE.street;
            const busy = edge.congestion > 1.35;
            return (
              <g key={edge.id}>
                <line
                  x1={pa.x}
                  y1={pa.y}
                  x2={pb.x}
                  y2={pb.y}
                  stroke="#04070e"
                  strokeWidth={style.width + 2.5}
                  opacity={0.75}
                />
                <line
                  x1={pa.x}
                  y1={pa.y}
                  x2={pb.x}
                  y2={pb.y}
                  stroke={busy ? "#6b4a3a" : style.stroke}
                  strokeWidth={style.width}
                />
                {edge.kind === "expressway" && (
                  <line
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    stroke="#7fa4dd"
                    strokeWidth={1}
                    strokeDasharray="6 8"
                    opacity={0.5}
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* highlighted shortest path */}
        {highlighted && (
          <g filter="url(#glow)">
            <polyline
              points={highlighted.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={highlighted.color}
              strokeWidth={14}
              opacity={0.14}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={highlighted.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={highlighted.color}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              className="route-flow"
              points={highlighted.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="#eafffb"
              strokeWidth={2.2}
              strokeLinecap="round"
              opacity={0.9}
            />
          </g>
        )}

        {/* Dijkstra exploration overlay */}
        {showExploration && route && (
          <g>
            {route.exploration.map((entry) => {
              const node = nodeById.get(entry.code);
              if (!node) return null;
              const p = geometry.toPx(node.x, node.y);
              const heat = Math.max(0, 1 - entry.order / Math.max(1, route.exploration.length));
              const fill = entry.code === route.from.code ? "#eafffb" : `rgba(46,224,194,${0.18 + heat * 0.6})`;
              return (
                <g key={`ex-${entry.code}`}>
                  <circle cx={p.x} cy={p.y} r={11} fill={fill} stroke="rgba(46,224,194,0.35)" strokeWidth={1} />
                  <text
                    x={p.x}
                    y={p.y + 3.4}
                    textAnchor="middle"
                    fontSize={10}
                    fontFamily="var(--font-mono)"
                    fontWeight={700}
                    fill={entry.code === route.from.code ? "#06231f" : "#dff9f4"}
                  >
                    {entry.order}
                  </text>
                  <text
                    x={p.x}
                    y={p.y - 15}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontFamily="var(--font-mono)"
                    fill="#8fb8ff"
                    className="map-label"
                  >
                    {entry.distMin.toFixed(1)}′
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* vertices */}
        <g>
          {graph.nodes.map((node) => {
            const p = geometry.toPx(node.x, node.y);
            const isSource = node.code === fromCode;
            const hospital = hospitalByNode.get(node.code);
            if (hospital) return null; // drawn in the hospital layer
            const exploration = explorationByCode.get(node.code);
            return (
              <g
                key={node.code}
                className="cursor-pointer"
                onClick={() => onSelectNode(node.code)}
                onMouseEnter={() =>
                  setHover({
                    kind: "node",
                    label: node.name ?? `Chowk ${node.code}`,
                    detail: node.district
                      ? `${node.district}${exploration ? ` · settled #${exploration.order} at ${exploration.distMin.toFixed(1)} min` : ""}`
                      : `Graph vertex ${node.code}${exploration ? ` · settled #${exploration.order}` : ""}`,
                  })
                }
                onMouseLeave={() => setHover(null)}
              >
                <circle cx={p.x} cy={p.y} r={13} fill="transparent" />
                {isSource && (
                  <>
                    <circle className="pulse-ring" cx={p.x} cy={p.y} r={12} fill="none" stroke="#2ee0c2" strokeWidth={2} />
                    <circle cx={p.x} cy={p.y} r={17} fill="rgba(46,224,194,0.1)" stroke="#2ee0c2" strokeWidth={1.4} />
                  </>
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={node.kind === "locality" ? 5.6 : 3.6}
                  fill={isSource ? "#2ee0c2" : node.kind === "locality" ? "#2a3c63" : "#1b2740"}
                  stroke={isSource ? "#eafffb" : "#5a74a8"}
                  strokeWidth={isSource ? 2 : 1.2}
                />
                {node.name && !showExploration && (
                  <text
                    x={p.x}
                    y={p.y + (node.kind === "locality" ? 19 : 16)}
                    textAnchor="middle"
                    fontSize={node.kind === "locality" ? 12 : 10.5}
                    fontWeight={node.kind === "locality" ? 600 : 400}
                    fill={isSource ? "#eafffb" : node.kind === "locality" ? "#b7c4e2" : "#6d7ea6"}
                    className="map-label"
                  >
                    {node.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* hospitals */}
        <g>
          {hospitals.map((hospital) => {
            const node = nodeById.get(hospital.nodeCode);
            if (!node) return null;
            const p = geometry.toPx(node.x, node.y);
            const free = availableBeds(hospital.beds, bedType);
            const tone = bedTone(free, hospital.beds[bedType].total);
            const colors = {
              good: { fill: "#0f3d36", stroke: "#2ee0c2", text: "#6ff2dc" },
              warn: { fill: "#3d3116", stroke: "#ffb443", text: "#ffd187" },
              bad: { fill: "#3d1a20", stroke: "#ff5f6d", text: "#ff96a0" },
            }[tone];
            const match = pathByHospital.get(hospital.id);
            const isActive = activeMatch?.hospital.id === hospital.id;
            const isSuggested = route?.suggestion?.hospital.id === hospital.id;
            const isDispatched = dispatch !== null && match?.hospital.id === hospital.id;
            return (
              <g
                key={hospital.id}
                className="cursor-pointer"
                onClick={() => onSelectHospital(hospital.id)}
                onMouseEnter={() =>
                  setHover({
                    kind: "hospital",
                    label: hospital.name,
                    detail: match
                      ? `${match.distanceKm} km · ETA ${match.etaMinutes} min · ${free} ${bedType.toUpperCase()} free · rank #${match.rank}`
                      : `${hospital.address} · ${free} ${bedType.toUpperCase()} free`,
                  })
                }
                onMouseLeave={() => setHover(null)}
              >
                <circle cx={p.x} cy={p.y} r={18} fill="transparent" />
                {(isSuggested || isDispatched) && (
                  <circle
                    className="pulse-ring"
                    cx={p.x}
                    cy={p.y}
                    r={16}
                    fill="none"
                    stroke={isDispatched ? "#ffb443" : "#2ee0c2"}
                    strokeWidth={2}
                  />
                )}
                <rect
                  x={p.x - 10}
                  y={p.y - 10}
                  width={20}
                  height={20}
                  rx={6}
                  fill={colors.fill}
                  stroke={isActive || isSuggested ? "#eafffb" : colors.stroke}
                  strokeWidth={isActive || isSuggested ? 2.4 : 1.6}
                />
                <path
                  d={`M ${p.x - 2.4} ${p.y - 6.2} h 4.8 v 3.8 h 3.8 v 4.8 h -3.8 v 3.8 h -4.8 v -3.8 h -3.8 v -4.8 h 3.8 z`}
                  fill={colors.text}
                />
                <g
                  transform={`translate(${p.x + (p.x + 39 > geometry.width - 6 ? -39 : 13)} ${p.y - 13})`}
                >
                  <rect x={0} y={-9} width={26} height={16} rx={5} fill="#070c17" stroke={colors.stroke} strokeWidth={1} />
                  <text
                    x={13}
                    y={3}
                    textAnchor="middle"
                    fontSize={11}
                    fontFamily="var(--font-mono)"
                    fontWeight={700}
                    fill={colors.text}
                  >
                    {free}
                  </text>
                </g>
                {(isActive || isSuggested || isDispatched) && (
                  <text
                    x={p.x}
                    y={p.y + 26}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={700}
                    fill="#eaf0ff"
                    className="map-label"
                  >
                    {hospital.name.length > 26 ? `${hospital.name.slice(0, 24)}…` : hospital.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* ambulance */}
        <g ref={ambulanceRef} opacity={0}>
          <g transform="translate(-13 -9)">
            <rect x={0} y={0} width={26} height={15} rx={4} fill="#f5f7ff" stroke="#0b1220" strokeWidth={1} />
            <rect x={17} y={2.5} width={7} height={6} rx={1.5} fill="#9fb4dd" />
            <circle cx={7} cy={16} r={3} fill="#0b1220" />
            <circle cx={20} cy={16} r={3} fill="#0b1220" />
            <rect className="siren-a" x={9} y={-4} width={4} height={4} rx={1} fill="#ff5f6d" />
            <rect className="siren-b" x={14} y={-4} width={4} height={4} rx={1} fill="#4aa8ff" />
            <path d="M3 3.5h3.4M4.7 1.8v3.4" stroke="#ff5f6d" strokeWidth={1.5} strokeLinecap="round" />
            <text
              x={9.5}
              y={12}
              fontSize={7}
              fontFamily="var(--font-mono)"
              fontWeight={700}
              fill="#e63e52"
            >
              108
            </text>
          </g>
        </g>

        <rect width={geometry.width} height={geometry.height} fill="url(#map-vignette)" pointerEvents="none" />

        {/* source label */}
        {fromNode && (
          <g pointerEvents="none">
            <text
              x={geometry.toPx(fromNode.x, fromNode.y).x}
              y={geometry.toPx(fromNode.x, fromNode.y).y - 24}
              textAnchor="middle"
              fontSize={12}
              fontWeight={700}
              fill="#2ee0c2"
              className="map-label"
            >
              PATIENT · {fromNode.name ?? fromNode.code}
            </text>
          </g>
        )}

        {/* ETA badge on the moving ambulance */}
        {dispatch && (dispatch.status === "dispatched" || dispatch.status === "en_route") && (
          <g pointerEvents="none" transform={`translate(${PAD} ${geometry.height - PAD * 0.9})`}>
            <rect x={0} y={-16} width={128} height={26} rx={7} fill="rgba(7,12,23,0.9)" stroke="#ffb443" strokeWidth={1} />
            <circle className="blink" cx={14} cy={-3} r={4} fill="#ffb443" />
            <text x={26} y={2} fontSize={12} fontFamily="var(--font-mono)" fontWeight={700} fill="#ffd187">
              ETA <tspan ref={etaRef}>{Math.round(dispatch.etaMinutes)} min</tspan>
            </text>
          </g>
        )}
      </svg>
        </div>
      </div>

      {/* hover read-out */}
      <div className="pointer-events-none absolute bottom-3 right-3 hidden max-w-[280px] rounded-lg border border-white/10 bg-night-950/85 px-3 py-2 backdrop-blur sm:block">
        {hover ? (
          <>
            <div className="text-[11px] font-semibold text-mist-100">{hover.label}</div>
            <div className="mt-0.5 font-mono text-[10px] leading-snug text-mist-500">{hover.detail}</div>
          </>
        ) : (
          <div className="font-mono text-[10px] leading-snug text-mist-500">
            Tap any chowk to move the patient · tap a hospital to see its route
          </div>
        )}
      </div>

      {/* legend */}
      <div className="pointer-events-none absolute left-3 top-3 hidden rounded-lg border border-white/10 bg-night-950/80 px-3 py-2 backdrop-blur sm:block">
        <div className="label-caps mb-1.5">Suryanagar road graph</div>
        <ul className="space-y-1 font-mono text-[10px] text-mist-300">
          <li className="flex items-center gap-2">
            <span className="inline-block h-[3px] w-5 rounded bg-[#3f5f96]" /> ring road / flyover
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-[3px] w-5 rounded bg-[#31456b]" /> marg (4-lane)
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-[3px] w-5 rounded bg-[#26344f]" /> gali / road
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-[3px] w-5 rounded bg-[#6b4a3a]" /> jam (traffic ×&gt;1.35)
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-[3px] w-5 rounded bg-[#1b5480]" /> Chandrabhaga river
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border border-[#2ee0c2] bg-[#0f3d36]" /> hospital · khaali beds
          </li>
        </ul>
      </div>
    </div>
  );
}
