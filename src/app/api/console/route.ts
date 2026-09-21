import { getConsoleBootstrap } from "@/lib/queries";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const bootstrap = await getConsoleBootstrap();
    return NextResponse.json({ ok: true, data: bootstrap });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the city network";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
