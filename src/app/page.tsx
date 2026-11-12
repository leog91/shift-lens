import { redirect } from "next/navigation";
import { dataMode } from "@/lib/data-mode";
import { headers } from "next/headers";
import { authorizedCompany } from "@/lib/hosted/auth";

export default async function Home() {
  const signedIn = dataMode() === "hosted" && await authorizedCompany(await headers());
  redirect(signedIn ? "/dashboard" : "/weeks");
}
