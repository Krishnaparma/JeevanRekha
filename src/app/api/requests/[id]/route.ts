import { updateRequestStatus } from "@/lib/queries";
import type { RequestStatus } from "@/lib/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const STATUSES: RequestStatus[] = ["reserved", "dispatched", "en_route", "admitted", "cancelled"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestId = Number.parseInt(id, 10);
  if (!Number.isFinite(requestId)) {
    return NextResponse.json({ ok: false, error: "Invalid request id." }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const status = String(payload.status ?? "") as RequestStatus;
  if (!STATUSES.includes(status)) {
    return NextResponse.json(
      { ok: false, error: `status must be one of ${STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const updated = await updateRequestStatus(requestId, status);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Dispatch not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the dispatch";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
