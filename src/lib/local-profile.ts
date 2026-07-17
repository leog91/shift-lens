import { join, resolve } from "node:path";

export function localProfileDirectory() {
  const configured = process.env.SHIFT_LENS_PROFILE_DIR?.trim();
  return configured ? resolve(process.cwd(), configured) : process.cwd();
}

export function localProfilePath(...parts: string[]) {
  return join(localProfileDirectory(), ...parts);
}
