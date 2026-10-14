import { chmod, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { cliFailure } from "./error-feedback.js";

// Contains no credentials. SQLite releases the process lock even after a crash.
export const withCredentialLock = async <A>(path: string, run: () => Promise<A>): Promise<A> => {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(path);
  try {
    if (process.platform !== "win32") await chmod(path, 0o600);
    database.exec("PRAGMA busy_timeout = 0");
    for (let attempt = 0; attempt < 200; attempt += 1) {
      try {
        database.exec("BEGIN IMMEDIATE");
      } catch (error) {
        if ((error as { errcode?: number }).errcode !== 5) throw error;
        // oxlint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      try {
        // oxlint-disable-next-line no-await-in-loop
        return await run();
      } finally {
        database.exec("ROLLBACK");
      }
    }
    throw cliFailure("AUTH_BUSY");
  } finally {
    database.close();
  }
};
