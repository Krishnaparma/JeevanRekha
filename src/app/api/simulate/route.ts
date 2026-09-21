import { loadEvents, loadGraph, loadHospitals, simulateTick } from "@/lib/queries";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** POST /api/simulate — advances the live bed/traffic feed one tick. */
export async function POST() {
  try {
    const tick = await simulateTick();
    return NextResponse.json({ ok: true, data: tick });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Simulation tick failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** GET /api/simulate — current live snapshot without mutating anything. */
export async function GET() {
  try {
    const [hospitals, events, graph] = await Promise.all([
      loadHospitals(),
      loadEvents(12),
      loadGraph(),
    ]);
    return NextResponse.json({ ok: true, data: { hospitals, events, graph, changedRoads: 0 } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the live feed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
