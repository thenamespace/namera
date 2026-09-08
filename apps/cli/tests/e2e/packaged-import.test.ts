import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Redacted, Schema } from "effect";

import { EncryptedLocalSessionKey } from "@namera-ai/protocol/local";
import { openLocalSessionKey, sealLocalSessionKey } from "@namera-ai/sdk";
import { Entry } from "@napi-rs/keyring";
import { describe, expect, it } from "vitest";

import { makeLocalSessionMaterial } from "../fixtures/local-session.js";

const decodeStoredKey = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({
      keyringId: Schema.String,
      encrypted: EncryptedLocalSessionKey,
    }),
  ),
);

const runImport = (directory: string, envelope: string, password: string) =>
  new Promise<string>((resolve, reject) => {
    const child = spawn(
      "python3",
      [
        "-c",
        "import os, pty, sys; sys.exit(os.waitstatus_to_exitcode(pty.spawn(sys.argv[1:])))",
        process.execPath,
        fileURLToPath(new URL("../../dist/index.js", import.meta.url)),
        "--output",
        "json",
        "session-key",
        "import",
        envelope,
      ],
      {
        env: {
          ...process.env,
          NODE_OPTIONS: "",
          XDG_CONFIG_HOME: directory,
          NAMERA_API_KEY: crypto.randomUUID(),
          NAMERA_API_URL: "http://localhost:8080",
          TERM: "xterm-256color",
        },
        stdio: "pipe",
      },
    );
    let output = "";
    let entered = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, 15_000);
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (!entered && output.includes("Export passphrase")) {
        entered = true;
        child.stdin.write(`${password}\r`);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", () => {
      clearTimeout(timer);
      if (timedOut || !entered)
        reject(
          new Error(
            `CLI import did not complete its prompt: ${output.replaceAll(password, "[redacted]").replaceAll(envelope, "[export]")}`,
          ),
        );
      else resolve(output);
    });
  });

describe.skipIf(process.platform !== "darwin" || process.env.NAMERA_TEST_OS_KEYRING !== "1")(
  "built CLI import on macOS",
  () => {
    it("hides the passphrase and imports through the actual command", async () => {
      const directory = await mkdtemp(join(tmpdir(), "namera-cli-import-"));
      const material = makeLocalSessionMaterial();
      const password = Redacted.make(crypto.randomUUID());
      const keysDirectory = join(directory, "namera", "session-keys");
      try {
        const encrypted = await sealLocalSessionKey(material, password);
        const output = await runImport(
          directory,
          Buffer.from(JSON.stringify(encrypted)).toString("base64url"),
          Redacted.value(password),
        );
        expect(output.includes(Redacted.value(password))).toBe(false);
        expect(output).toContain('"status":"imported"');
        const files = await readdir(keysDirectory);
        expect(files).toHaveLength(1);
        const filename = files[0];
        if (filename === undefined) throw new Error("Expected imported key file");
        const stored = decodeStoredKey(await readFile(join(keysDirectory, filename), "utf8"));
        const unlock = new Entry("namera-session-keystore", stored.keyringId).getPassword();
        if (!unlock) throw new Error("Expected OS unlock credential");
        const secret = Redacted.make(unlock);
        try {
          const opened = await openLocalSessionKey(stored.encrypted, secret);
          expect(Redacted.value(opened.privateKey) === Redacted.value(material.privateKey)).toBe(
            true,
          );
          Redacted.wipeUnsafe(opened.privateKey);
        } finally {
          Redacted.wipeUnsafe(secret);
        }
      } finally {
        Redacted.wipeUnsafe(password);
        Redacted.wipeUnsafe(material.privateKey);
        try {
          const files = await readdir(keysDirectory).catch(() => []);
          await Promise.all(
            files.map(async (filename) => {
              const stored = decodeStoredKey(await readFile(join(keysDirectory, filename), "utf8"));
              new Entry("namera-session-keystore", stored.keyringId).deletePassword();
            }),
          );
        } finally {
          await rm(directory, { recursive: true });
        }
      }
    }, 25_000);
  },
);
