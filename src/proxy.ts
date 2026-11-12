import { NextRequest, NextResponse } from "next/server";
import { dataMode } from "@/lib/data-mode";
import { hostedRouteAllowed } from "@/lib/hosted/routes";

export function proxy(request: NextRequest) {
  if (dataMode() !== "hosted") return NextResponse.next();
  const response = hostedRouteAllowed(request.nextUrl.pathname, request.method)
    ? NextResponse.next() : new NextResponse(null, { status: 404 });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const config = { matcher: "/:path*" };
