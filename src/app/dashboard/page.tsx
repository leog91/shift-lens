import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { dataMode } from "@/lib/data-mode";
import { authorizedCompany } from "@/lib/hosted/auth";
import { hostedDatabase } from "@/lib/hosted/database";
import { readPublishedSnapshot } from "@/lib/hosted/snapshots";
import { HostedDashboard } from "@/components/HostedDashboard";

export const dynamic = "force-dynamic";
export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (dataMode() !== "hosted") notFound();
  const company = await authorizedCompany(await headers());
  if (!company) redirect("/login");
  const published = await readPublishedSnapshot(hostedDatabase(), company);
  return <HostedDashboard snapshot={published?.snapshot ?? null} receivedAt={published?.receivedAt ?? null} query={await searchParams} />;
}
