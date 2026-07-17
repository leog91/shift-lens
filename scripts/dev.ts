import { spawn } from "node:child_process";

const commands = [
  ["bun", ["run", "dev:web"]],
  ["bun", ["run", "dev:ocr"]]
] as const;

for (const [cmd, args] of commands) {
  const child = spawn(cmd, args, { stdio: "inherit", shell: true });
  child.on("exit", (code) => {
    if (code && code !== 0) process.exitCode = code;
  });
}
