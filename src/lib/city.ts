import type { BedInventory, EdgeKind, NodeKind } from "./types";

/**
 * Deterministic generator for **Suryanagar** — a fictional Indian metro whose
 * road network powers the graph algorithms. Everything comes from a seeded
 * PRNG, so the city is identical on every machine and after every reset.
 *
 * Shape of the network:
 *  - 8 × 6 grid of chowks / junctions (x = km east, y = km south)
 *  - the Chandrabhaga river flowing north→south, crossable only at
 *    Shivaji Setu and Rani Lakshmibai Setu
 *  - the Suryanagar suburban railway line, crossed only at two underpasses
 *  - flyovers and the Outer Ring Road so the road distance differs from the
 *    straight-line distance
 *  - every hospital hangs off the grid with its own gate vertex
 */

const COLS = 8;
const ROWS = 6;
const DX = 1.95;
const DY = 1.8;
const ORIGIN_X = 1.0;
const ORIGIN_Y = 0.9;
export const SEED = 20260117;

export const CITY_NAME = "Suryanagar";
export const RIVER_NAME = "Chandrabhaga";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function random(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeedNode {
  code: string;
  name: string | null;
  district: string | null;
  x: number;
  y: number;
  kind: NodeKind;
}

export interface SeedEdge {
  fromCode: string;
  toCode: string;
  road: string;
  kind: EdgeKind;
  distanceKm: number;
  speedKmh: number;
  lanes: number;
  congestion: number;
}

export interface SeedHospital {
  name: string;
  slug: string;
  nodeCode: string;
  junctionCode: string;
  address: string;
  phone: string;
  traumaLevel: number;
  hasBloodBank: boolean;
  hasNeonatal: boolean;
  specialties: string[];
  rating: number;
  ambulances: number;
  beds: Record<keyof BedInventory, { total: number; occupied: number }>;
}

export interface City {
  nodes: SeedNode[];
  edges: SeedEdge[];
  hospitals: SeedHospital[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  river: { x: number; points: { x: number; y: number }[] };
}

const junctionCode = (r: number, c: number) => `J${r}${c}`;

/** Named localities of Suryanagar. */
const LOCALITIES: { r: number; c: number; name: string; district: string }[] = [
  { r: 0, c: 0, name: "Bandar Gate", district: "Purana Bandar" },
  { r: 0, c: 2, name: "Gulmohar Bagh", district: "Paschim Vihar" },
  { r: 0, c: 4, name: "Vimanpura Link", district: "Vimanpura" },
  { r: 0, c: 6, name: "Shanti Tekdi", district: "Purva Pahadi" },
  { r: 1, c: 1, name: "Machhi Bazaar", district: "Paschim Bandar" },
  { r: 1, c: 3, name: "Purana Killa", district: "Killa Kshetra" },
  { r: 1, c: 5, name: "Uttar Tekdi", district: "Uttar Tekdi" },
  { r: 2, c: 0, name: "Chowpatty Chowk", district: "Paschim Vihar" },
  { r: 2, c: 2, name: "Chandrabhaga Ghat", district: "Ghat Kshetra" },
  { r: 2, c: 4, name: "Suryanagar Junction", district: "Shahar Kendra" },
  { r: 2, c: 6, name: "Dhyan Chand Stadium", district: "Krida Nagar" },
  { r: 3, c: 1, name: "Girni Chowk", district: "Kapda Mill Patti" },
  { r: 3, c: 3, name: "Vishwavidyalaya Campus", district: "Gyan Vihar" },
  { r: 3, c: 5, name: "Chhawani Chowk", district: "Chhawani" },
  { r: 4, c: 0, name: "Rani Talab Circle", district: "Talab Kshetra" },
  { r: 4, c: 2, name: "Sagar Talab Junction", district: "Talab Kshetra" },
  { r: 4, c: 4, name: "Harit Nagar Cross", district: "Harit Nagar" },
  { r: 4, c: 6, name: "Infocity Gate", district: "Infocity Corridor" },
  { r: 5, c: 1, name: "Lohapur Colony", district: "Dakshin Patti" },
  { r: 5, c: 3, name: "Sahyadri Heights", district: "Dakshin Patti" },
  { r: 5, c: 5, name: "Dakshin Bandar", district: "Purana Bandar" },
  { r: 5, c: 7, name: "Infocity Dakshin", district: "Infocity Corridor" },
];

/** East–west arterial roads, one per grid row. */
const ROW_ROADS = [
  { name: "Bandar Road", kind: "street" as EdgeKind, speed: 32, lanes: 2 },
  { name: "Netaji Subhash Marg", kind: "avenue" as EdgeKind, speed: 46, lanes: 4 },
  { name: "Mahatma Gandhi Road", kind: "avenue" as EdgeKind, speed: 48, lanes: 4 },
  { name: "Tilak Marg", kind: "street" as EdgeKind, speed: 34, lanes: 2 },
  { name: "Sardar Patel Marg", kind: "avenue" as EdgeKind, speed: 44, lanes: 4 },
  { name: "Dakshin Ring Road", kind: "street" as EdgeKind, speed: 36, lanes: 2 },
];

/** North–south roads, one per grid column. */
const COL_ROADS = [
  "Kasturba Marg",
  "Bandar Link Road",
  "Killa Marg",
  "Vishwavidyalaya Marg",
  "Jawaharlal Nehru Marg",
  "Chhawani Marg",
  "Infocity Marg",
  "Tekdi Ridge Road",
];

const HOSPITAL_DEFS: (Omit<SeedHospital, "nodeCode" | "junctionCode" | "slug"> & {
  r: number;
  c: number;
})[] = [
  {
    name: "Sanjeevani Multispeciality Hospital",
    r: 2,
    c: 4,
    address: "1, Jawaharlal Nehru Marg, Shahar Kendra",
    phone: "+91 731 400 1200",
    traumaLevel: 1,
    hasBloodBank: true,
    hasNeonatal: true,
    specialties: ["Trauma", "Cardiology", "Neurology", "Burns"],
    rating: 4.6,
    ambulances: 14,
    beds: {
      icu: { total: 28, occupied: 24 },
      ventilator: { total: 14, occupied: 12 },
      general: { total: 180, occupied: 132 },
      emergency: { total: 16, occupied: 9 },
    },
  },
  {
    name: "Sushruta Memorial Medical Centre",
    r: 1,
    c: 1,
    address: "22, Bandar Link Road, Machhi Bazaar",
    phone: "+91 731 400 2311",
    traumaLevel: 2,
    hasBloodBank: true,
    hasNeonatal: false,
    specialties: ["General surgery", "Orthopaedics", "Dialysis"],
    rating: 4.2,
    ambulances: 8,
    beds: {
      icu: { total: 16, occupied: 16 },
      ventilator: { total: 8, occupied: 7 },
      general: { total: 96, occupied: 61 },
      emergency: { total: 10, occupied: 10 },
    },
  },
  {
    name: "Charaka Emergency & Trauma Care",
    r: 2,
    c: 2,
    address: "Mahatma Gandhi Road, Chandrabhaga Ghat",
    phone: "+91 731 400 3422",
    traumaLevel: 1,
    hasBloodBank: true,
    hasNeonatal: false,
    specialties: ["Emergency medicine", "Trauma", "Toxicology"],
    rating: 4.4,
    ambulances: 11,
    beds: {
      icu: { total: 20, occupied: 15 },
      ventilator: { total: 10, occupied: 8 },
      general: { total: 74, occupied: 52 },
      emergency: { total: 14, occupied: 5 },
    },
  },
  {
    name: "Lok Nayak Trauma Institute",
    r: 1,
    c: 5,
    address: "9, Tekdi Ridge Road, Uttar Tekdi",
    phone: "+91 731 400 4533",
    traumaLevel: 1,
    hasBloodBank: true,
    hasNeonatal: false,
    specialties: ["Trauma", "Spine", "Vascular surgery"],
    rating: 4.5,
    ambulances: 9,
    beds: {
      icu: { total: 18, occupied: 11 },
      ventilator: { total: 12, occupied: 4 },
      general: { total: 60, occupied: 44 },
      emergency: { total: 12, occupied: 3 },
    },
  },
  {
    name: "Matru Seva Children's Hospital",
    r: 4,
    c: 0,
    address: "Rani Talab Circle, Talab Kshetra",
    phone: "+91 731 400 5644",
    traumaLevel: 3,
    hasBloodBank: false,
    hasNeonatal: true,
    specialties: ["Paediatrics", "NICU", "Paediatric surgery"],
    rating: 4.7,
    ambulances: 6,
    beds: {
      icu: { total: 12, occupied: 7 },
      ventilator: { total: 6, occupied: 2 },
      general: { total: 54, occupied: 28 },
      emergency: { total: 6, occupied: 2 },
    },
  },
  {
    name: "Indira Gandhi Super Speciality Hospital",
    r: 0,
    c: 4,
    address: "Vimanpura Link Road, Vimanpura",
    phone: "+91 731 400 6755",
    traumaLevel: 2,
    hasBloodBank: true,
    hasNeonatal: true,
    specialties: ["Transplants", "Oncology", "Cardiology"],
    rating: 4.8,
    ambulances: 12,
    beds: {
      icu: { total: 34, occupied: 26 },
      ventilator: { total: 18, occupied: 15 },
      general: { total: 140, occupied: 88 },
      emergency: { total: 8, occupied: 4 },
    },
  },
  {
    name: "Army Base Hospital, Chhawani",
    r: 3,
    c: 5,
    address: "Chhawani Chowk, Suryanagar Cantonment",
    phone: "+91 731 400 7866",
    traumaLevel: 2,
    hasBloodBank: true,
    hasNeonatal: false,
    specialties: ["Emergency medicine", "Orthopaedics", "Rehabilitation"],
    rating: 4.1,
    ambulances: 7,
    beds: {
      icu: { total: 14, occupied: 9 },
      ventilator: { total: 8, occupied: 6 },
      general: { total: 120, occupied: 54 },
      emergency: { total: 10, occupied: 2 },
    },
  },
  {
    name: "Jan Arogya Community Hospital",
    r: 4,
    c: 4,
    address: "Harit Nagar Cross, Harit Nagar",
    phone: "+91 731 400 8977",
    traumaLevel: 3,
    hasBloodBank: false,
    hasNeonatal: false,
    specialties: ["Family medicine", "Obstetrics", "Ayurveda & Panchakarma"],
    rating: 3.9,
    ambulances: 4,
    beds: {
      icu: { total: 8, occupied: 8 },
      ventilator: { total: 3, occupied: 3 },
      general: { total: 66, occupied: 31 },
      emergency: { total: 5, occupied: 1 },
    },
  },
  {
    name: "Hridayam Cardiac Institute",
    r: 0,
    c: 6,
    address: "Tekdi Ridge Road, Shanti Tekdi",
    phone: "+91 731 400 9088",
    traumaLevel: 3,
    hasBloodBank: true,
    hasNeonatal: false,
    specialties: ["Cardiology", "Cardiac surgery", "Cath lab"],
    rating: 4.6,
    ambulances: 5,
    beds: {
      icu: { total: 22, occupied: 17 },
      ventilator: { total: 10, occupied: 6 },
      general: { total: 48, occupied: 30 },
      emergency: { total: 6, occupied: 3 },
    },
  },
  {
    name: "Ashwini Critical Care Centre",
    r: 4,
    c: 2,
    address: "Sardar Patel Marg, Sagar Talab",
    phone: "+91 731 400 1199",
    traumaLevel: 2,
    hasBloodBank: true,
    hasNeonatal: false,
    specialties: ["Critical care", "Pulmonology", "Nephrology"],
    rating: 4.3,
    ambulances: 6,
    beds: {
      icu: { total: 24, occupied: 13 },
      ventilator: { total: 14, occupied: 5 },
      general: { total: 40, occupied: 22 },
      emergency: { total: 8, occupied: 6 },
    },
  },
];

/**
 * Short, natural form of a hospital name for its approach road, e.g.
 * "Lok Nayak Trauma Institute" → "Lok Nayak", "Sanjeevani …" → "Sanjeevani".
 */
function shortHospitalName(name: string): string {
  const words = name.replace(/[.,&]/g, "").split(/\s+/).filter(Boolean);
  const first = words[0] ?? name;
  if (first.length >= 7 || words.length < 2) return first;
  return `${first} ${words[1]}`;
}

/** x position of the Chandrabhaga centre line at a given y. */
function riverXAt(y: number): number {
  return 7.85 + 0.42 * Math.sin((y - 0.9) * 0.72);
}

/** Centre line of the river, used by the map renderer (PRNG-free). */
export function riverCenterPoints(): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let y = -0.4; y <= 11.2; y += 0.5) {
    points.push({ x: Number(riverXAt(y).toFixed(3)), y: Number(y.toFixed(3)) });
  }
  return points;
}

export function buildCity(): City {
  const random = mulberry32(SEED);
  const nodes: SeedNode[] = [];
  const edges: SeedEdge[] = [];
  const coords = new Map<string, { x: number; y: number }>();

  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const jitterX = (random() - 0.5) * 0.34;
      const jitterY = (random() - 0.5) * 0.3;
      const x = Number((ORIGIN_X + c * DX + jitterX).toFixed(3));
      const y = Number((ORIGIN_Y + r * DY + jitterY).toFixed(3));
      const code = junctionCode(r, c);
      coords.set(code, { x, y });
      const locality = LOCALITIES.find((l) => l.r === r && l.c === c);
      nodes.push({
        code,
        name: locality ? locality.name : null,
        district: locality ? locality.district : null,
        x,
        y,
        kind: locality ? "locality" : "junction",
      });
    }
  }

  const congestionFor = (kind: EdgeKind) => {
    const base = kind === "expressway" ? 0.9 : kind === "avenue" ? 1.05 : 1.15;
    return Number((base + random() * 0.35).toFixed(2));
  };

  const pushEdge = (
    fromCode: string,
    toCode: string,
    road: string,
    kind: EdgeKind,
    speedKmh: number,
    lanes: number,
    factor: number,
    congestion = congestionFor(kind),
  ) => {
    const a = coords.get(fromCode);
    const b = coords.get(toCode);
    if (!a || !b) return;
    const straight = Math.hypot(a.x - b.x, a.y - b.y);
    edges.push({
      fromCode,
      toCode,
      road,
      kind,
      distanceKm: Number((straight * factor).toFixed(3)),
      speedKmh,
      lanes,
      congestion,
    });
  };

  // East–west roads, minus the river (setus at rows 1 and 4).
  for (let r = 0; r < ROWS; r += 1) {
    const rowRoad = ROW_ROADS[r] as (typeof ROW_ROADS)[number];
    for (let c = 0; c < COLS - 1; c += 1) {
      const a = coords.get(junctionCode(r, c));
      const b = coords.get(junctionCode(r, c + 1));
      if (!a || !b) continue;
      const riverX = riverXAt((a.y + b.y) / 2);
      if (Math.min(a.x, b.x) < riverX && riverX < Math.max(a.x, b.x)) {
        if (r === 1) {
          pushEdge(junctionCode(r, c), junctionCode(r, c + 1), "Shivaji Setu", "bridge", 34, 2, 1.02);
        } else if (r === 4) {
          pushEdge(
            junctionCode(r, c),
            junctionCode(r, c + 1),
            "Rani Lakshmibai Setu",
            "bridge",
            38,
            4,
            1.02,
          );
        }
        continue;
      }
      pushEdge(
        junctionCode(r, c),
        junctionCode(r, c + 1),
        rowRoad.name,
        rowRoad.kind,
        rowRoad.speed,
        rowRoad.lanes,
        rowRoad.kind === "avenue" ? 1.08 : 1.18,
      );
    }
  }

  // North–south roads, minus the suburban railway line between rows 2 and 3.
  for (let c = 0; c < COLS; c += 1) {
    for (let r = 0; r < ROWS - 1; r += 1) {
      if (r === 2 && c !== 7) continue; // railway line — only the underpasses cross
      pushEdge(
        junctionCode(r, c),
        junctionCode(r + 1, c),
        COL_ROADS[c] as string,
        c === 4 ? "avenue" : "street",
        c === 4 ? 46 : 34,
        c === 4 ? 4 : 2,
        1.14,
      );
    }
  }

  // Flyovers and the Outer Ring Road.
  const expressways: [number, number, number, number, string][] = [
    [0, 2, 1, 3, "Gulmohar Flyover"],
    [1, 1, 2, 2, "Bandar Flyover"],
    [2, 4, 3, 5, "Suryanagar Outer Ring Road"],
    [3, 5, 4, 6, "Suryanagar Outer Ring Road"],
    [4, 4, 5, 5, "Harit Nagar Flyover"],
    [1, 5, 2, 6, "Dhyan Chand Flyover"],
    [3, 3, 4, 2, "Vishwavidyalaya Underpass"],
  ];
  for (const [r1, c1, r2, c2, road] of expressways) {
    pushEdge(junctionCode(r1, c1), junctionCode(r2, c2), road, "expressway", 72, 6, 1.04);
  }

  // Railway underpasses that keep the grid connected across the line.
  pushEdge(junctionCode(2, 1), junctionCode(3, 1), "Girni Chowk Underpass", "avenue", 42, 4, 1.1);
  pushEdge(junctionCode(2, 5), junctionCode(3, 5), "Chhawani Underpass", "avenue", 42, 4, 1.1);

  // Hospital gate vertices + approach roads.
  const hospitals: SeedHospital[] = HOSPITAL_DEFS.map((def, index) => {
    const junction = junctionCode(def.r, def.c);
    const anchor = coords.get(junction) as { x: number; y: number };
    const angle = (index / HOSPITAL_DEFS.length) * Math.PI * 2;
    const hx = Number((anchor.x + Math.cos(angle) * 0.42).toFixed(3));
    const hy = Number((anchor.y + Math.sin(angle) * 0.42).toFixed(3));
    const code = `H${index + 1}`;
    coords.set(code, { x: hx, y: hy });
    nodes.push({ code, name: def.name, district: null, x: hx, y: hy, kind: "hospital" });
    edges.push({
      fromCode: junction,
      toCode: code,
      road: `${shortHospitalName(def.name)} Hospital Marg`,
      kind: "street",
      distanceKm: 0.42,
      speedKmh: 22,
      lanes: 1,
      congestion: Number((1 + random() * 0.1).toFixed(2)),
    });
    return {
      ...def,
      nodeCode: code,
      junctionCode: junction,
      slug: def.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
    };
  });

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);

  return {
    nodes,
    edges,
    hospitals,
    bounds: {
      minX: Math.min(...xs) - 0.6,
      minY: Math.min(...ys) - 0.6,
      maxX: Math.max(...xs) + 0.6,
      maxY: Math.max(...ys) + 0.6,
    },
    river: { x: 7.85, points: riverCenterPoints() },
  };
}
