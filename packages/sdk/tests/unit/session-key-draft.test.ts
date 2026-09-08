import { Redacted } from "effect";

import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";

import { openLocalSessionKey } from "../../src/signing/keystore.js";
import { createLocalSessionKeyDraft } from "../../src/signing/session-key-draft.js";
import { localExecutionFixture } from "../fixtures/local-execution.js";

describe("client-held session key draft", () => {
  it("exports the generated signer without exposing its private material on the handle", async () => {
    const draft = createLocalSessionKeyDraft();
    const password = Redacted.make("test-only export passphrase");
    try {
      const binding = { ...localExecutionFixture().binding, signerAddress: draft.signerAddress };
      const envelope = await draft.seal("http://localhost:8080", [binding], password);
      const material = await openLocalSessionKey(envelope, password);
      const account = privateKeyToAccount(Redacted.value(material.privateKey));
      expect(draft.signer).toEqual({
        custody: "local",
        algorithm: "secp256k1",
        publicKey: account.publicKey,
      });
      expect(account.address).toBe(draft.signerAddress);
      expect(material.bindings).toEqual([binding]);
      expect(JSON.stringify(draft)).not.toContain(Redacted.value(material.privateKey));
    } finally {
      draft.dispose();
    }
  });

  it("rejects mismatched authority without losing the draft needed for a corrected export", async () => {
    const draft = createLocalSessionKeyDraft();
    const password = Redacted.make("test-only export passphrase");
    try {
      const binding = localExecutionFixture().binding;
      await expect(draft.seal("http://localhost:8080", [binding], password)).rejects.toMatchObject({
        code: "ENCRYPTION_FAILED",
      });
      await expect(
        draft.seal(
          "http://localhost:8080",
          [{ ...binding, signerAddress: draft.signerAddress }],
          password,
        ),
      ).resolves.toMatchObject({ type: "namera-local-session-key" });
    } finally {
      draft.dispose();
    }
  });

  it("disposal is idempotent and prevents both new and in-flight exports", async () => {
    const draft = createLocalSessionKeyDraft();
    const password = Redacted.make("test-only export passphrase");
    const bindings = [{ ...localExecutionFixture().binding, signerAddress: draft.signerAddress }];
    const pending = draft.seal("http://localhost:8080", bindings, password);
    draft.dispose();
    draft.dispose();
    await expect(pending).rejects.toMatchObject({ code: "DRAFT_DISPOSED" });
    await expect(draft.seal("http://localhost:8080", bindings, password)).rejects.toMatchObject({
      code: "DRAFT_DISPOSED",
    });
  });
});
