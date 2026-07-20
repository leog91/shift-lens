import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the native SQLite module available to server functions on Vercel.
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: ["127.0.0.1"],
  experimental: { serverActions: { bodySizeLimit: "20mb" } }
};

export default nextConfig;
