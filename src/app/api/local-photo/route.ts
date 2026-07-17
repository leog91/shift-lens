import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { isPhotoInboxPath, photoInboxRoot } from "@/lib/photo-inbox";
import { localProfilePath } from "@/lib/local-profile";
import { isLocalDataMode } from "@/lib/data-mode";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

export function GET(request: NextRequest) {
  if (!isLocalDataMode()) return new NextResponse("Not found", { status: 404 });
  const relativePath = request.nextUrl.searchParams.get("path");
  if (!relativePath) return new NextResponse("Missing path", { status: 400 });
  if (!isPhotoInboxPath(relativePath)) return new NextResponse("Not found", { status: 404 });
  const photoRoot = resolve(/* turbopackIgnore: true */ localProfilePath(photoInboxRoot));
  const filePath = resolve(/* turbopackIgnore: true */ localProfilePath(relativePath));
  if (!filePath.startsWith(photoRoot) || !existsSync(filePath)) return new NextResponse("Not found", { status: 404 });
  const type = contentTypes[extname(filePath).toLowerCase()];
  if (!type) return new NextResponse("Unsupported file type", { status: 415 });
  return new NextResponse(readFileSync(filePath), { headers: { "content-type": type } });
}
