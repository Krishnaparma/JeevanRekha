import { createBedRequest, loadRequests } from "@/lib/queries";
import { BED_TYPES, SEVERITIES, type BedType, type Severity } from "@/lib/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BED_IDS = BED_TYPES.map((b) => b.id) as string[];
const SEVERITY_IDS = SEVERITIES.map((s) => s.id) as string[];

export async function GET() {
  try {
    const requests = await loadRequests(20);
    return NextResponse.json({ ok: true, data: requests });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load dispatches";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const patientName = String(payload.patientName ?? "").trim().slice(0, 60);
  const patientAge = Number.parseInt(String(payload.patientAge ?? "30"), 10);
  const fromCode = String(payload.fromCode ?? "").trim();
  const hospitalId = Number.parseInt(String(payload.hospitalId ?? ""), 10);
  const bedType = BED_IDS.includes(String(payload.bedType)) ? (String(payload.bedType) as BedType) : null;
  const severity = SEVERITY_IDS.includes(String(payload.severity))
    ? (String(payload.severity) as Severity)
    : null;

  if (!patientName) {
    return NextResponse.json({ ok: false, error: "Patient name is required." }, { status: 400 });
  }
  if (!Number.isFinite(patientAge) || patientAge < 0 || patientAge > 120) {
    return NextResponse.json({ ok: false, error: "Patient age must be between 0 and 120." }, { status: 400 });
  }
  if (!fromCode || !Number.isFinite(hospitalId) || !bedType || !severity) {
    return NextResponse.json(
      { ok: false, error: "fromCode, hospitalId, bedType and severity are required." },
      { status: 400 },
    );
  }

  try {
    const result = await createBedRequest({
      patientName,
      patientAge,
      severity,
      bedType,
      fromCode,
      hospitalId,
    });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reserve the bed";
    return NextResponse.json({ ok: false, error: message }, { status: 409 });
  }
}
