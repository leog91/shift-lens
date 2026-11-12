import "./globals.css";
import type { Metadata } from "next";
import { dataMode } from "@/lib/data-mode";
import { SyncStatus } from "@/components/SyncStatus";
import { headers } from "next/headers";
import { authorizedCompany } from "@/lib/hosted/auth";
import { AppHeader } from "@/components/AppHeader";

// Never bake local records or a mode-specific redirect into a production build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ShiftLens",
  description: "Local-first actual versus paid hours reconciliation",
  icons: { icon: "/favicon.svg" }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const mode = dataMode();
  const signedIn = mode === "hosted" && Boolean(await authorizedCompany(await headers()));
  return (
    <html lang="en">
      <body>
        <AppHeader mode={mode} signedIn={signedIn} />
        {mode === "local" ? <SyncStatus /> : null}
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
