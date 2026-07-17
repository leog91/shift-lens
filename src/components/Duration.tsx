import { formatDuration } from "@/domain/reconciliation";

export function Duration({ minutes }: { minutes: number }) {
  return <span>{formatDuration(minutes)}</span>;
}
