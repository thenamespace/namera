import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Redacted } from "effect";

import { sealLocalSessionKey } from "@namera-ai/sdk";
import { Entry } from "@napi-rs/keyring";
import { describe, expect, it } from "vitest";

import { createSessionKeystore } from "../../src/services/session-keystore/storage.js";
import { makeLocalSessionMaterial } from "../fixtures/local-session.js";

describe.skipIf(process.env.NAMERA_TEST_OS_KEYRING !== "1")("real OS session keyring", () => {
  it("imports and reopens a key using the platform credential store", async () => {
    const directory = await mkdtemp(join(tmpdir(), "namera-os-keyring-"));
    const service = `namera-keyring-test-${crypto.randomUUID()}`;
    const ids = new Set<string>();
    const material = makeLocalSessionMaterial();
    const password = Redacted.make(crypto.randomUUID());
    const keyring = {
      get: (id: string) => new Entry(service, id).getPassword(),
      set: (id: string, secret: string) => {
        ids.add(id);
        new Entry(service, id).setPassword(secret);
      },
      delete: (id: string) => {
        new Entry(service, id).deletePassword();
        ids.delete(id);
      },
    };
    try {
      const encrypted = await sealLocalSessionKey(material, password);
      const imported = await createSessionKeystore(directory, keyring).importKey(
        encrypted,
        password,
        material.apiOrigin,
      );
      expect(ids.size).toBe(1);
      const filename = (await readdir(directory))[0];
      if (filename === undefined) throw new Error("Expected encrypted key file");
      const stored = await readFile(join(directory, filename), "utf8");
      expect(stored).not.toContain(Redacted.value(material.privateKey));
      expect(stored).not.toContain(Redacted.value(password));
      if (process.platform !== "win32")
        expect((await stat(join(directory, filename))).mode & 0o777).toBe(0o600);
      const reopened = await createSessionKeystore(directory, keyring).readKey(
        material.apiOrigin,
        imported.sessionKeyId,
      );
      try {
        expect(Redacted.value(reopened.privateKey) === Redacted.value(material.privateKey)).toBe(
          true,
        );
        expect(reopened.bindings).toEqual(material.bindings);
      } finally {
        Redacted.wipeUnsafe(reopened.privateKey);
      }
    } finally {
      Redacted.wipeUnsafe(password);
      Redacted.wipeUnsafe(material.privateKey);
      try {
        for (const id of ids) keyring.delete(id);
      } finally {
        await rm(directory, { recursive: true });
      }
    }
  });
});
