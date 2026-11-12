import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { dataMode } from "@/lib/data-mode";
import { hostedConfig } from "@/lib/hosted/config";
import { hostedDatabase } from "@/lib/hosted/database";
import { acceptSnapshot, SyncConflict } from "@/lib/hosted/snapshots";

export const runtime = "nodejs";
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  if (dataMode() !== "hosted") return new NextResponse(null, { status: 404 });
  try {
    const config = hostedConfig();
    const hash = (value: string) => createHash("sha256").update(value).digest();
    if (!timingSafeEqual(hash(request.headers.get("authorization") ?? ""), hash(`Bearer ${config.syncToken}`))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Count streamed bytes as well as Content-Length; chunked bodies cannot bypass the cap.
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Missing body" }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "Snapshot exceeds 5 MiB" }, { status: 413 });
      }
      chunks.push(value);
    }
    const input: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const revision = await acceptSnapshot(hostedDatabase(), config.companyId, config.sourceId, input);
    return NextResponse.json({ revision }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SyncConflict) return NextResponse.json({ error: "Sync source or revision conflict" }, { status: 409 });
    if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid verified-data snapshot" }, { status: 400 });
    return NextResponse.json({ error: "Sync unavailable" }, { status: 503 });
  }
}
