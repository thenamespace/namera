import { spawn } from "node:child_process";

import { onTestFinished } from "vitest";

export const runInteractiveCli = (
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  prompts: readonly { matches: readonly string[]; input: string }[],
) => {
  const child = spawn(
    "python3",
    [
      "-c",
      "import os, pty, sys; sys.exit(os.waitstatus_to_exitcode(pty.spawn(sys.argv[1:])))",
      process.execPath,
      "--conditions=namera-source",
      "--import",
      "tsx",
      "src/index.ts",
      ...args,
    ],
    {
      cwd: new URL("../../", import.meta.url),
      env: { ...process.env, TERM: "xterm-256color", NO_COLOR: "1", ...env },
      detached: true,
      stdio: "pipe",
    },
  );
  const stop = () => {
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      process.kill(-child.pid, "SIGKILL");
    }
  };
  const closed = new Promise<void>((resolve) => child.once("close", () => resolve()));
  onTestFinished(async () => {
    stop();
    await closed;
  });

  return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    let output = "";
    let promptIndex = 0;
    const timer = setTimeout(() => {
      stop();
      reject(new Error(`CLI prompt timed out: ${output}`));
    }, 60_000);
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      const prompt = prompts[promptIndex];
      if (prompt && prompt.matches.every((text) => output.includes(text))) {
        promptIndex++;
        child.stdin.write(prompt.input);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
};
