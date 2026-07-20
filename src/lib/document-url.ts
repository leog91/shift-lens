export function documentUrl(path: string) {
  return path.startsWith("/demo/") ? path : `/api/local-photo?path=${encodeURIComponent(path)}`;
}
