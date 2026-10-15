import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

import { withCredentialLock } from "../../../src/services/credential-lock.js";

it("releases a credential lock when its owning process is killed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "namera-lock-crash-"));
  const path = join(directory, "auth.lock.sqlite");
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `
    import { DatabaseSync } from 'node:sqlite';
    const database = new DatabaseSync(process.argv[1]);
    database.exec('BEGIN IMMEDIATE');
    process.stdout.write('locked');
    setInterval(() => {}, 1000);
  `,
      path,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  try {
    await once(child.stdout, "data");
    const exit = once(child, "exit");
    child.kill("SIGKILL");
    await exit;
    expect(await withCredentialLock(path, async () => "acquired")).toBe("acquired");
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exit = once(child, "exit");
      child.kill("SIGKILL");
      await exit;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
