import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { dataMode } from "@/lib/data-mode";
import { authorizedCompany } from "@/lib/hosted/auth";
import { HostedLogin } from "@/components/HostedAuthClient";

export const dynamic = "force-dynamic";
export default async function LoginPage() {
  if (dataMode() !== "hosted") notFound();
  if (await authorizedCompany(await headers())) redirect("/dashboard");
  return <section className="mx-auto grid max-w-md gap-4 rounded border bg-white p-6">
    <h1 className="text-2xl font-semibold">Private hours dashboard</h1>
    <p>Sign in with your owner email and password to view verified hours. Original documents remain on the local computer.</p>
    <HostedLogin />
  </section>;
}
