import { computeRoute } from "@/lib/queries";
import { BED_TYPES, SEVERITIES, type BedType, type Severity } from "@/lib/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BED_IDS = BED_TYPES.map((b) => b.id);
const SEVERITY_IDS = SEVERITIES.map((s) => s.id);

function parse(input: unknown): { fromCode: string; bedType: BedType; severity: Severity } | null {
  const body = (input ?? {}) as Record<string, unknown>;
  const fromCode = typeof body.fromCode === "string" ? body.fromCode : "";
  const bedType = (BED_IDS as string[]).includes(String(body.bedType))
    ? (String(body.bedType) as BedType)
    : "icu";
  const severity = (SEVERITY_IDS as string[]).includes(String(body.severity))
    ? (String(body.severity) as Severity)
    : "urgent";
  if (!fromCode) return null;
  return { fromCode, bedType, severity };
}

/** GET /api/route?from=J24&bed=icu&severity=urgent */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parse({
    fromCode: url.searchParams.get("from"),
    bedType: url.searchParams.get("bed"),
    severity: url.searchParams.get("severity"),
  });
  if (!parsed) {
    return NextResponse.json({ ok: false, error: "A `from` node code is required." }, { status: 400 });
  }
  try {
    const result = await computeRoute(parsed);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Routing failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

/** POST /api/route { fromCode, bedType, severity } */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = parse(payload);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: "A `fromCode` is required." }, { status: 400 });
  }
  try {
    const result = await computeRoute(parsed);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Routing failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
