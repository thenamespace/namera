import { Encoding, Redacted, Result, Schema } from "effect";

import { EncryptedLocalSessionKey, LocalSessionKeyMaterial } from "@namera-ai/protocol/local";
import { isAddressEqual } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export class LocalKeystoreError extends Schema.TaggedError<LocalKeystoreError>()(
  "LocalKeystoreError",
  { code: Schema.Literals(["INVALID_LOCAL_KEY", "ENCRYPTION_FAILED", "DECRYPTION_FAILED"]) },
) {}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const additionalData = encoder.encode(
  "namera:local-session-key:v1:PBKDF2-SHA256:600000:AES-256-GCM",
);

const deriveKey = async (password: Redacted.Redacted<string>, salt: Uint8Array<ArrayBuffer>) => {
  const passwordBytes = encoder.encode(Redacted.value(password));
  try {
    if (passwordBytes.byteLength === 0) throw new LocalKeystoreError({ code: "INVALID_LOCAL_KEY" });
    const material = await globalThis.crypto.subtle.importKey(
      "raw",
      passwordBytes,
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    return await globalThis.crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: 600_000 },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  } finally {
    passwordBytes.fill(0);
  }
};

const validateKey = (material: LocalSessionKeyMaterial) => {
  const account = privateKeyToAccount(Redacted.value(material.privateKey));
  if (
    material.bindings.some((binding) => !isAddressEqual(binding.signerAddress, account.address))
  ) {
    throw new LocalKeystoreError({ code: "INVALID_LOCAL_KEY" });
  }
};

/** Encrypt locally. Neither this material nor the password belongs in API requests. */
export const sealLocalSessionKey = async (
  material: LocalSessionKeyMaterial,
  password: Redacted.Redacted<string>,
): Promise<EncryptedLocalSessionKey> => {
  let plaintext: Uint8Array<ArrayBuffer> | undefined;
  try {
    const encoded = Schema.encodeSync(LocalSessionKeyMaterial)(material);
    validateKey(material);
    plaintext = encoder.encode(JSON.stringify(encoded));
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData, tagLength: 128 },
      key,
      plaintext,
    );
    return {
      version: 1,
      type: "namera-local-session-key",
      encryption: "AES-256-GCM",
      kdf: "PBKDF2-SHA256",
      iterations: 600_000,
      salt: Encoding.encodeBase64Url(salt),
      iv: Encoding.encodeBase64Url(iv),
      ciphertext: Encoding.encodeBase64Url(new Uint8Array(ciphertext)),
    };
  } catch {
    // Schema and provider errors can include plaintext input. Never expose them.
    throw new LocalKeystoreError({ code: "ENCRYPTION_FAILED" });
  } finally {
    plaintext?.fill(0);
  }
};

export const openLocalSessionKey = async (
  input: unknown,
  password: Redacted.Redacted<string>,
): Promise<LocalSessionKeyMaterial> => {
  let plaintext: Uint8Array<ArrayBuffer> | undefined;
  try {
    const envelope = Schema.decodeUnknownSync(EncryptedLocalSessionKey)(input);
    const key = await deriveKey(
      password,
      new Uint8Array(Result.getOrThrow(Encoding.decodeBase64Url(envelope.salt))),
    );
    plaintext = new Uint8Array(
      await globalThis.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: new Uint8Array(Result.getOrThrow(Encoding.decodeBase64Url(envelope.iv))),
          additionalData,
          tagLength: 128,
        },
        key,
        new Uint8Array(Result.getOrThrow(Encoding.decodeBase64Url(envelope.ciphertext))),
      ),
    );
    const material = Schema.decodeUnknownSync(LocalSessionKeyMaterial)(
      JSON.parse(decoder.decode(plaintext)),
    );
    validateKey(material);
    return material;
  } catch {
    throw new LocalKeystoreError({ code: "DECRYPTION_FAILED" });
  } finally {
    plaintext?.fill(0);
  }
};
