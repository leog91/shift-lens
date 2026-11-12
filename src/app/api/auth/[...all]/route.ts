import { NextRequest, NextResponse } from "next/server";
import { dataMode } from "@/lib/data-mode";
import { hostedAuth } from "@/lib/hosted/auth";

export const runtime = "nodejs";
async function handle(request: NextRequest) {
  if (dataMode() !== "hosted") return new NextResponse(null, { status: 404 });
  return hostedAuth().handler(request);
}
export { handle as GET, handle as POST };
