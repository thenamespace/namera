import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  chmod,
  rename,
  symlink,
  truncate,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Redacted } from "effect";

import { sealLocalSessionKey } from "@namera-ai/sdk";
import { onTestFinished, describe, expect, it, vi } from "vitest";

import { createSessionKeystore } from "../../../src/node/storage.js";
import { makeLocalSessionMaterial } from "../../fixtures/local-session.js";

const setup = async () => {
  const directory = await mkdtemp(join(tmpdir(), "namera-keystore-test-"));
  onTestFinished(() => rm(directory, { recursive: true }));
  const secrets = new Map<string, string>();
  const keyring = {
    get: vi.fn((id: string) => secrets.get(id) ?? null),
    set: (id: string, secret: string) => {
      secrets.set(id, secret);
    },
    delete: (id: string) => {
      secrets.delete(id);
    },
  };
  const material = makeLocalSessionMaterial();
  const password = Redacted.make("test-only portable export passphrase");
  const encrypted = await sealLocalSessionKey(material, password);
  const store = createSessionKeystore(directory, keyring);
  return { directory, secrets, material, password, encrypted, store, keyring };
};

describe("Node session key storage", () => {
  it("reports decryption failures without writing credentials or files", async () => {
    const f = await setup();
    await expect(
      f.store.importKey(f.encrypted, Redacted.make("wrong-passphrase"), f.material.apiOrigin),
    ).rejects.toMatchObject({ code: "DECRYPT_FAILED" });
    expect(f.secrets.size).toBe(0);
    expect(await readdir(f.directory)).toEqual([]);
  });
  it("imports into private encrypted files and unlocks with an independent keyring secret", async () => {
    const f = await setup();
    const result = await f.store.importKey(f.encrypted, f.password, f.material.apiOrigin);
    expect(result.chains).toEqual(["eip155:11155111"]);
    const files = await readdir(f.directory);
    expect(files).toHaveLength(1);
    const filename = files[0];
    if (filename === undefined) throw new Error("Expected an imported key file");
    const file = join(f.directory, filename);
    const contents = await readFile(file, "utf8");
    expect(contents).not.toContain(Redacted.value(f.material.privateKey));
    expect(contents).not.toContain(Redacted.value(f.password));
    expect(f.secrets.size).toBe(1);
    for (const secret of f.secrets.values()) {
      expect(contents).not.toContain(secret);
      expect(secret).not.toBe(Redacted.value(f.password));
    }
    if (process.platform !== "win32") expect((await stat(file)).mode & 0o777).toBe(0o600);
    const opened = await f.store.readKey(f.material.apiOrigin, result.sessionKeyId);
    expect(Redacted.value(opened.privateKey)).toBe(Redacted.value(f.material.privateKey));
    expect(opened.bindings).toEqual(f.material.bindings);
  });

  it("never overwrites an existing import and removes only the failed import's new secret", async () => {
    const f = await setup();
    const result = await f.store.importKey(f.encrypted, f.password, f.material.apiOrigin);
    const originalSecrets = [...f.secrets.entries()];
    await expect(
      f.store.importKey(f.encrypted, f.password, f.material.apiOrigin),
    ).rejects.toMatchObject({ code: "ALREADY_IMPORTED" });
    expect([...f.secrets.entries()]).toEqual(originalSecrets);
    expect(await readdir(f.directory)).toHaveLength(1);
    await expect(f.store.readKey(f.material.apiOrigin, result.sessionKeyId)).resolves.toMatchObject(
      { apiOrigin: f.material.apiOrigin },
    );
  });

  it("rejects a different API origin without persisting secrets or files", async () => {
    const f = await setup();
    await expect(
      f.store.importKey(f.encrypted, f.password, "https://api.example.com"),
    ).rejects.toMatchObject({ code: "ORIGIN_MISMATCH" });
    expect(f.secrets.size).toBe(0);
    expect(await readdir(f.directory)).toEqual([]);
  });

  it("fails closed when the OS keyring is unavailable", async () => {
    const f = await setup();
    const broken = createSessionKeystore(f.directory, {
      ...f.keyring,
      set: () => {
        throw new Error("unavailable");
      },
    });
    await expect(
      broken.importKey(f.encrypted, f.password, f.material.apiOrigin),
    ).rejects.toMatchObject({ code: "KEYRING_UNAVAILABLE" });
    expect(await readdir(f.directory)).toEqual([]);
    const result = await f.store.importKey(f.encrypted, f.password, f.material.apiOrigin);
    f.secrets.clear();
    await expect(f.store.readKey(f.material.apiOrigin, result.sessionKeyId)).rejects.toMatchObject({
      code: "UNLOCK_UNAVAILABLE",
    });
  });

  it.skipIf(process.platform === "win32")("refuses a world-readable key file", async () => {
    const f = await setup();
    const result = await f.store.importKey(f.encrypted, f.password, f.material.apiOrigin);
    const files = await readdir(f.directory);
    const filename = files[0];
    if (filename === undefined) throw new Error("Expected an imported key file");
    await chmod(join(f.directory, filename), 0o644);
    await expect(f.store.readKey(f.material.apiOrigin, result.sessionKeyId)).rejects.toMatchObject({
      code: "READ_FAILED",
    });
    expect(f.keyring.get).not.toHaveBeenCalled();
  });

  it.each(["oversized", "directory", "symlink"] as const)(
    "rejects a %s record before looking up its unlock secret",
    async (kind) => {
      const f = await setup();
      const result = await f.store.importKey(f.encrypted, f.password, f.material.apiOrigin);
      const [filename] = await readdir(f.directory);
      if (!filename) throw new Error("Missing imported key file");
      const path = join(f.directory, filename);

      if (kind === "oversized") await truncate(path, 128 * 1024 + 1);
      else {
        const original = join(f.directory, "original.json");
        await rename(path, original);
        if (kind === "directory") await mkdir(path);
        else await symlink(original, path);
      }

      await expect(
        f.store.readKey(f.material.apiOrigin, result.sessionKeyId),
      ).rejects.toMatchObject({
        code: "READ_FAILED",
      });
      expect(f.keyring.get).not.toHaveBeenCalled();
      expect(f.secrets.size).toBe(1);
    },
  );
});
