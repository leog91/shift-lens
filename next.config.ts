import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isolate browser-test builds from an already running local workspace.
  distDir: process.env.SHIFT_LENS_NEXT_DIST_DIR ?? ".next",
  // Keep the native SQLite module available to server functions on Vercel.
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: ["127.0.0.1"],
  experimental: { serverActions: { bodySizeLimit: "110mb" } }
};

export default nextConfig;
