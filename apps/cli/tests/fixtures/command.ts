import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { onTestFinished } from "vitest";

const execute = promisify(execFile);

export const runCli = (args: readonly string[], env: NodeJS.ProcessEnv) => {
  const command = execute(
    process.execPath,
    ["--conditions=namera-source", "--import", "tsx", "src/index.ts", ...args],
    {
      cwd: new URL("../../", import.meta.url),
      env: { ...process.env, NO_COLOR: "1", ...env },
      timeout: 60_000,
    },
  );
  onTestFinished(async () => {
    // Await termination before another test resets the shared HTTP fixture.
    if (command.child.exitCode === null && command.child.signalCode === null) {
      command.child.kill("SIGKILL");
    }
    await command.catch(() => undefined);
  });
  return command;
};
