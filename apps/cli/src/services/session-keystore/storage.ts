import { createHash, randomBytes, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { chmod, link, lstat, mkdir, open, unlink } from "node:fs/promises";
import { join } from "node:path";

import { Predicate, Redacted, Schema } from "effect";

import { SessionKeyId } from "@namera-ai/protocol";
import { EncryptedLocalSessionKey, type LocalSessionKeyMaterial } from "@namera-ai/protocol/local";
import { openLocalSessionKey, sealLocalSessionKey } from "@namera-ai/sdk";

export interface SessionKeyring {
  readonly get: (id: string) => string | null;
  readonly set: (id: string, secret: string) => void;
  readonly delete: (id: string) => void;
}

const StoredSession = Schema.Struct({
  version: Schema.Literal(1),
  keyringId: Schema.String.check(Schema.isPattern(/^[0-9a-f-]{36}$/)),
  encrypted: EncryptedLocalSessionKey,
});

export class SessionKeystoreError extends Schema.TaggedError<SessionKeystoreError>()(
  "SessionKeystoreError",
  {
    code: Schema.Literals([
      "IMPORT_FAILED",
      "INVALID_EXPORT",
      "DECRYPT_FAILED",
      "ALREADY_IMPORTED",
      "KEYRING_UNAVAILABLE",
      "ORIGIN_MISMATCH",
      "READ_FAILED",
      "UNLOCK_UNAVAILABLE",
    ]),
  },
) {}

export const createSessionKeystore = (directory: string, keyring: SessionKeyring) => {
  const pathFor = (apiOrigin: string, sessionKeyId: SessionKeyId) => {
    const id = Schema.decodeUnknownSync(SessionKeyId)(sessionKeyId);
    const host = createHash("sha256").update(apiOrigin).digest("hex");
    return join(directory, `${host}-${id}.json`);
  };

  const importKey = async (
    input: unknown,
    password: Redacted.Redacted<string>,
    apiOrigin: string,
  ) => {
    let material: LocalSessionKeyMaterial;
    try {
      material = await openLocalSessionKey(input, password);
    } catch {
      throw new SessionKeystoreError({ code: "DECRYPT_FAILED" });
    }
    if (material.apiOrigin !== apiOrigin)
      throw new SessionKeystoreError({ code: "ORIGIN_MISMATCH" });
    const binding = material.bindings[0];
    if (binding === undefined) throw new SessionKeystoreError({ code: "IMPORT_FAILED" });
    const keyringId = randomUUID();
    const unlockSecret = randomBytes(32).toString("base64url");
    const encrypted = await sealLocalSessionKey(material, Redacted.make(unlockSecret));
    const temporaryPath = join(directory, `.${randomUUID()}.tmp`);
    let savedSecret = false;
    let temporaryCreated = false;
    let installed = false;
    let failed = false;
    let failureCode: typeof SessionKeystoreError.Type.code = "IMPORT_FAILED";
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const directoryStat = await lstat(directory);
      if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink())
        throw new Error("Unsafe directory");
      if (process.platform !== "win32") await chmod(directory, 0o700);
      try {
        keyring.set(keyringId, unlockSecret);
      } catch {
        throw new SessionKeystoreError({ code: "KEYRING_UNAVAILABLE" });
      }
      savedSecret = true;
      const handle = await open(temporaryPath, "wx", 0o600);
      temporaryCreated = true;
      try {
        await handle.writeFile(JSON.stringify({ version: 1, keyringId, encrypted }));
        await handle.sync();
      } finally {
        await handle.close();
      }
      // Hard-link installation is atomic and refuses to overwrite an existing key.
      // The random keyring ID prevents a failed import from deleting its secret.
      try {
        await link(temporaryPath, pathFor(apiOrigin, binding.sessionKeyId));
      } catch (error) {
        if (Predicate.isObject(error) && error.code === "EEXIST")
          throw new SessionKeystoreError({ code: "ALREADY_IMPORTED" });
        throw error;
      }
      installed = true;
    } catch (error) {
      failed = true;
      if (error instanceof SessionKeystoreError) failureCode = error.code;
    }

    // Attempt both cleanup steps even if one fails. Decide the result afterward,
    // rather than replacing a return or exception from inside a finally block.
    try {
      if (temporaryCreated) await unlink(temporaryPath);
    } catch {
      failed = true;
      failureCode = "IMPORT_FAILED";
    }
    try {
      if (!installed && savedSecret) keyring.delete(keyringId);
    } catch {
      failed = true;
      failureCode = "IMPORT_FAILED";
    }
    if (failed) throw new SessionKeystoreError({ code: failureCode });
    return {
      sessionKeyId: binding.sessionKeyId,
      walletId: binding.walletId,
      chains: material.bindings.map((entry) => entry.chainId),
    };
  };

  const readKey = async (
    apiOrigin: string,
    sessionKeyId: SessionKeyId,
  ): Promise<LocalSessionKeyMaterial> => {
    let record: typeof StoredSession.Type;
    try {
      const handle = await open(
        pathFor(apiOrigin, sessionKeyId),
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      try {
        const stat = await handle.stat();
        if (
          !stat.isFile() ||
          stat.size > 128 * 1024 ||
          (process.platform !== "win32" && (stat.mode & 0o077) !== 0)
        )
          throw new Error("Unsafe keystore file");
        record = Schema.decodeUnknownSync(StoredSession)(JSON.parse(await handle.readFile("utf8")));
      } finally {
        await handle.close();
      }
    } catch {
      throw new SessionKeystoreError({ code: "READ_FAILED" });
    }
    let password: string | null;
    try {
      password = keyring.get(record.keyringId);
    } catch {
      throw new SessionKeystoreError({ code: "UNLOCK_UNAVAILABLE" });
    }
    if (password === null) throw new SessionKeystoreError({ code: "UNLOCK_UNAVAILABLE" });
    const material = await openLocalSessionKey(record.encrypted, Redacted.make(password));
    if (
      material.apiOrigin !== apiOrigin ||
      material.bindings.some((binding) => binding.sessionKeyId !== sessionKeyId)
    )
      throw new SessionKeystoreError({ code: "ORIGIN_MISMATCH" });
    return material;
  };

  return { importKey, readKey };
};
