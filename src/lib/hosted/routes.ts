export function isHostedDemoPage(path: string) {
  return ["/weeks", "/hours", "/analytics", "/employees", "/photos", "/backups", "/settings/extraction"].includes(path)
    || path.startsWith("/weeks/") || path.startsWith("/employees/");
}

// One deployment: read-only fictional demo plus an authenticated private dashboard.
// No local processing, file-serving APIs, or mutations are exposed in hosted mode.
export function hostedRouteAllowed(path: string, method: string) {
  if (path === "/api/sync") return method === "POST";
  if (path.startsWith("/api/auth/")) return method === "GET" || method === "POST";
  if (method !== "GET" && method !== "HEAD") return false;
  return ["/", "/login", "/dashboard", "/favicon.svg"].includes(path) || isHostedDemoPage(path)
    || path.startsWith("/demo/") || path.startsWith("/_next/static/");
}
