import { Redacted, Schema } from "effect";

import { LocalEvmSessionBinding, LocalSessionKeyMaterial } from "@namera-ai/protocol/local";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";

import { openLocalSessionKey, sealLocalSessionKey } from "../../src/signing/keystore.js";
import { localExecutionFixture } from "../fixtures/local-execution.js";

const fixture = () => {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const binding = localExecutionFixture().binding;
  return Schema.decodeUnknownSync(LocalSessionKeyMaterial)({
    version: 1,
    namespace: "eip155",
    apiOrigin: "http://localhost:8080",
    privateKey,
    bindings: [
      { ...Schema.encodeSync(LocalEvmSessionBinding)(binding), signerAddress: account.address },
    ],
  });
};

describe("portable local session keystore", () => {
  it("round-trips key and authority with random salt and nonce, without plaintext in the envelope", async () => {
    const material = fixture();
    const password = Redacted.make("test-only export passphrase");
    const first = await sealLocalSessionKey(material, password);
    const second = await sealLocalSessionKey(material, password);
    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain(Redacted.value(material.privateKey));
    expect(serialized).not.toContain(material.apiOrigin);
    const opened = await openLocalSessionKey(JSON.parse(serialized), password);
    expect(opened.bindings).toEqual(material.bindings);
    expect(Redacted.value(opened.privateKey)).toBe(Redacted.value(material.privateKey));
    expect(JSON.stringify(opened)).not.toContain(Redacted.value(material.privateKey));
  });

  it("rejects wrong passwords and authenticated ciphertext tampering with a sanitized error", async () => {
    const password = Redacted.make("test-only export passphrase");
    const encrypted = await sealLocalSessionKey(fixture(), password);
    await expect(
      openLocalSessionKey(encrypted, Redacted.make("wrong passphrase")),
    ).rejects.toMatchObject({ code: "DECRYPTION_FAILED" });
    const altered = {
      ...encrypted,
      ciphertext: `${encrypted.ciphertext[0] === "A" ? "B" : "A"}${encrypted.ciphertext.slice(1)}`,
    };
    await expect(openLocalSessionKey(altered, password)).rejects.toMatchObject({
      code: "DECRYPTION_FAILED",
    });
    await expect(
      openLocalSessionKey({ ...encrypted, iterations: 1 }, password),
    ).rejects.toMatchObject({ code: "DECRYPTION_FAILED" });
  });

  it("refuses exporting a key that does not match the approved signer", async () => {
    const material = fixture();
    const wrong = { ...material, privateKey: Redacted.make(generatePrivateKey()) };
    await expect(
      sealLocalSessionKey(wrong, Redacted.make("test-only passphrase")),
    ).rejects.toMatchObject({ code: "ENCRYPTION_FAILED" });
  });
});
