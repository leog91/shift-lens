"use client";

import { useEffect, useState } from "react";

export function SyncStatus() {
  const [message, setMessage] = useState("Checking verified-data sync…");
  useEffect(() => {
    const controller = new AbortController();
    const update = async () => {
      try {
        const response = await fetch("/api/sync/status", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Status unavailable");
        const status = await response.json() as { message: string };
        setMessage(status.message);
      } catch { if (!controller.signal.aborted) setMessage("Sync status unavailable."); }
    };
    void update();
    const timer = setInterval(() => void update(), 15_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  return <p role="status" className="border-b bg-stone-50 px-4 py-2 text-center text-sm">{message}</p>;
}
