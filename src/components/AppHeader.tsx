"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DataMode } from "@/lib/data-mode";
import { isHostedDemoPage } from "@/lib/hosted/routes";

export function AppHeader({ mode, signedIn }: { mode: DataMode; signedIn: boolean }) {
  const pathname = usePathname();
  // Layouts persist across client navigation, so the demo label must follow the
  // current URL rather than a server-rendered layout's original request path.
  const demo = mode === "demo" || (mode === "hosted" && isHostedDemoPage(pathname));
  const privateArea = mode === "hosted" && signedIn && !demo;
  return <>
    <header className="app-header">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link className="app-brand" href={mode === "hosted" ? "/" : "/weeks"}>ShiftLens</Link>
        {privateArea ? <nav className="app-nav" aria-label="Main navigation"><Link href="/dashboard">Verified hours</Link><Link href="/weeks">View demo</Link></nav> : <nav className="app-nav" aria-label="Main navigation">
          <Link href="/weeks">Weeks</Link><Link href="/hours">Hours</Link><Link href="/analytics">Analytics</Link>
          <Link href="/photos">Photos</Link><Link href="/employees">Employees</Link><Link href="/backups">Backups</Link><Link href="/settings/extraction">Extraction</Link>
          {mode === "hosted" ? <Link href={signedIn ? "/dashboard" : "/login"}>{signedIn ? "My verified hours" : "Sign in"}</Link> : null}
        </nav>}
      </div>
    </header>
    {demo ? <p className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950">Demo account: all records and documents are fictional. Editing and local file processing are disabled.</p> : null}
  </>;
}
