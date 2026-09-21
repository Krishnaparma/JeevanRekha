import { db } from "@/db";
import { bedEvents, graphEdges, graphNodes, hospitals } from "@/db/schema";
import { buildCity } from "@/lib/city";
import { sql } from "drizzle-orm";

const globalForSeed = globalThis as typeof globalThis & {
  __bedlineSeed?: Promise<void>;
};

/**
 * Idempotent seed: creates the Suryanagar road network and its hospitals the
 * first time the database is empty. Safe to call from every server entry point
 * (guarded by a shared promise, executed inside one transaction).
 */
export function ensureSeeded(): Promise<void> {
  if (!globalForSeed.__bedlineSeed) {
    globalForSeed.__bedlineSeed = seed().catch((error) => {
      globalForSeed.__bedlineSeed = undefined;
      throw error;
    });
  }
  return globalForSeed.__bedlineSeed;
}

async function seed(): Promise<void> {
  const existing = await db.select({ count: sql<number>`count(*)::int` }).from(graphNodes);
  const count = existing[0]?.count ?? 0;
  if (count > 0) return;

  const city = buildCity();

  await db.transaction(async (tx) => {
    await tx.insert(graphNodes).values(
      city.nodes.map((node) => ({
        code: node.code,
        name: node.name,
        district: node.district,
        x: node.x,
        y: node.y,
        kind: node.kind,
      })),
    );

    await tx.insert(graphEdges).values(
      city.edges.map((edge) => ({
        fromCode: edge.fromCode,
        toCode: edge.toCode,
        road: edge.road,
        kind: edge.kind,
        distanceKm: edge.distanceKm,
        speedKmh: edge.speedKmh,
        lanes: edge.lanes,
        congestion: edge.congestion,
      })),
    );

    const inserted = await tx
      .insert(hospitals)
      .values(
        city.hospitals.map((hospital) => ({
          name: hospital.name,
          slug: hospital.slug,
          nodeCode: hospital.nodeCode,
          junctionCode: hospital.junctionCode,
          address: hospital.address,
          phone: hospital.phone,
          traumaLevel: hospital.traumaLevel,
          hasBloodBank: hospital.hasBloodBank,
          hasNeonatal: hospital.hasNeonatal,
          specialties: hospital.specialties.join(", "),
          rating: hospital.rating,
          ambulances: hospital.ambulances,
          icuTotal: hospital.beds.icu.total,
          icuOccupied: hospital.beds.icu.occupied,
          ventilatorTotal: hospital.beds.ventilator.total,
          ventilatorOccupied: hospital.beds.ventilator.occupied,
          generalTotal: hospital.beds.general.total,
          generalOccupied: hospital.beds.general.occupied,
          emergencyTotal: hospital.beds.emergency.total,
          emergencyOccupied: hospital.beds.emergency.occupied,
        })),
      )
      .returning({ id: hospitals.id, name: hospitals.name });

    await tx.insert(bedEvents).values(
      inserted.slice(0, 6).map((hospital, index) => ({
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        bedType: index % 2 === 0 ? "icu" : "general",
        delta: index % 2 === 0 ? -1 : 1,
        reason:
          index % 2 === 0
            ? "Bed released after discharge"
            : "108 ambulance brought in a casualty case",
      })),
    );
  });
}

/** Restores the seeded baseline city (demo control). */
export async function resetCity(): Promise<void> {
  globalForSeed.__bedlineSeed = undefined;
  await db.execute(sql`delete from bed_events`);
  await db.execute(sql`delete from bed_requests`);
  await db.execute(sql`delete from hospitals`);
  await db.execute(sql`delete from graph_edges`);
  await db.execute(sql`delete from graph_nodes`);
  await db.execute(sql`alter sequence graph_nodes_id_seq restart with 1`);
  await db.execute(sql`alter sequence graph_edges_id_seq restart with 1`);
  await db.execute(sql`alter sequence hospitals_id_seq restart with 1`);
  await db.execute(sql`alter sequence bed_events_id_seq restart with 1`);
  await db.execute(sql`alter sequence bed_requests_id_seq restart with 1`);
  await ensureSeeded();
}
