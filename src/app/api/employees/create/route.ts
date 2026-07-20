import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLocalEmployee } from "@/lib/local-sqlite-store";
import { requireLocalDataMode } from "@/lib/data-mode";

const CreateEmployeeSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  aliases: z.array(z.string().trim().min(1).max(120)).max(20).default([])
});

export async function POST(request: NextRequest) {
  try {
    requireLocalDataMode();
    const input = CreateEmployeeSchema.parse(await request.json());
    const aliases = [...new Set(input.aliases.filter((alias) => alias.localeCompare(input.displayName, undefined, { sensitivity: "accent" }) !== 0))];
    return NextResponse.json({ ok: true, employee: createLocalEmployee(input.displayName, aliases) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to create employee." }, { status: 400 });
  }
}
