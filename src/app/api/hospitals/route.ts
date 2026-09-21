import { loadHospitals, networkSummary } from "@/lib/queries";
import { totalAvailableBeds } from "@/lib/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** GET /api/hospitals — live bed inventory of every hospital in Suryanagar. */
export async function GET() {
  try {
    const [hospitals, summary] = await Promise.all([loadHospitals(), networkSummary()]);
    return NextResponse.json({
      ok: true,
      data: {
        hospitals: hospitals.map((hospital) => ({
          ...hospital,
          freeBeds: totalAvailableBeds(hospital.beds),
        })),
        summary,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load hospitals";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
