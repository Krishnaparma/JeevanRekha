import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Vertices of the road-network graph. */
export const graphNodes = pgTable(
  "graph_nodes",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name"),
    district: text("district"),
    x: doublePrecision("x").notNull(),
    y: doublePrecision("y").notNull(),
    kind: text("kind").notNull().default("junction"),
  },
);

/** Undirected edges (stored once, traversed both ways) with live congestion. */
export const graphEdges = pgTable(
  "graph_edges",
  {
    id: serial("id").primaryKey(),
    fromCode: text("from_code").notNull(),
    toCode: text("to_code").notNull(),
    road: text("road").notNull(),
    kind: text("kind").notNull().default("street"),
    distanceKm: doublePrecision("distance_km").notNull(),
    speedKmh: doublePrecision("speed_kmh").notNull(),
    lanes: integer("lanes").notNull().default(2),
    congestion: doublePrecision("congestion").notNull().default(1),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("graph_edges_pair_idx").on(table.fromCode, table.toCode)],
);

/** Hospitals with per-category bed occupancy. */
export const hospitals = pgTable("hospitals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  nodeCode: text("node_code").notNull(),
  junctionCode: text("junction_code").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  traumaLevel: integer("trauma_level").notNull().default(3),
  hasBloodBank: boolean("has_blood_bank").notNull().default(false),
  hasNeonatal: boolean("has_neonatal").notNull().default(false),
  specialties: text("specialties").notNull().default(""),
  rating: doublePrecision("rating").notNull().default(4),
  ambulances: integer("ambulances").notNull().default(2),
  icuTotal: integer("icu_total").notNull().default(0),
  icuOccupied: integer("icu_occupied").notNull().default(0),
  ventilatorTotal: integer("ventilator_total").notNull().default(0),
  ventilatorOccupied: integer("ventilator_occupied").notNull().default(0),
  generalTotal: integer("general_total").notNull().default(0),
  generalOccupied: integer("general_occupied").notNull().default(0),
  emergencyTotal: integer("emergency_total").notNull().default(0),
  emergencyOccupied: integer("emergency_occupied").notNull().default(0),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/** Every bed reservation produced by the console, with the path that was used. */
export const bedRequests = pgTable("bed_requests", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  patientName: text("patient_name").notNull(),
  patientAge: integer("patient_age").notNull().default(30),
  severity: text("severity").notNull().default("urgent"),
  bedType: text("bed_type").notNull().default("icu"),
  fromNodeCode: text("from_node_code").notNull(),
  fromLabel: text("from_label").notNull(),
  hospitalId: integer("hospital_id").notNull(),
  hospitalName: text("hospital_name").notNull(),
  distanceKm: doublePrecision("distance_km").notNull(),
  etaMinutes: doublePrecision("eta_minutes").notNull(),
  pathCodes: text("path_codes").notNull(),
  roads: text("roads").notNull().default(""),
  status: text("status").notNull().default("reserved"),
  nodesSettled: integer("nodes_settled").notNull().default(0),
  heapOps: integer("heap_ops").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/** Audit trail of live bed-occupancy changes (the "live feed"). */
export const bedEvents = pgTable("bed_events", {
  id: serial("id").primaryKey(),
  hospitalId: integer("hospital_id").notNull(),
  hospitalName: text("hospital_name").notNull(),
  bedType: text("bed_type").notNull(),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export type GraphNodeRow = typeof graphNodes.$inferSelect;
export type GraphEdgeRow = typeof graphEdges.$inferSelect;
export type HospitalRow = typeof hospitals.$inferSelect;
export type BedRequestRow = typeof bedRequests.$inferSelect;
export type BedEventRow = typeof bedEvents.$inferSelect;
