import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { dataMode } from "@/lib/data-mode";

export const metadata: Metadata = {
  title: "ShiftLens",
  description: "Local-first actual versus paid hours reconciliation",
  icons: { icon: "/favicon.svg" }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const mode = dataMode();
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link className="app-brand" href="/weeks">ShiftLens</Link>
            <nav className="app-nav" aria-label="Main navigation">
              <Link href="/weeks">Weeks</Link>
              <Link href="/analytics">Analytics</Link>
              <Link href="/photos">Photos</Link>
              <Link href="/employees">Employees</Link>
              <Link href="/settings/extraction">Extraction</Link>
            </nav>
          </div>
        </header>
        {mode === "demo" ? <p className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950">Demo account: all records and documents are fictional. Editing and local file processing are disabled.</p> : null}
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
