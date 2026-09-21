import { resetCity } from "@/db/seed";
import { getConsoleBootstrap } from "@/lib/queries";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** POST /api/reset — restores the seeded baseline city (demo control). */
export async function POST() {
  try {
    await resetCity();
    const bootstrap = await getConsoleBootstrap();
    return NextResponse.json({ ok: true, data: bootstrap });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reset failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
