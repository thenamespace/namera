import { createDecipheriv } from "node:crypto";

import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { CryptoError } from "@namera-ai/protocol";

import { CryptoService, cryptoPurpose } from "../../src/index.js";
import { cryptoLayer, testKey } from "../fixtures/crypto.js";

layer(cryptoLayer())("authenticated encryption", (it) => {
  it.effect.each(["", "Private 🔐 credential\nwith Unicode and a null byte\0"])(
    "round trips plaintext and authenticates its purpose: %#",
    (value) =>
      Effect.gen(function* () {
        const crypto = yield* CryptoService;
        const purpose = cryptoPurpose.providerCredential;
        const encrypted = yield* crypto.encrypt({ purpose, value });

        expect(yield* crypto.decrypt({ purpose, value: encrypted })).toBe(value);
        const [version, encodedIv = "", encodedPayload = ""] = encrypted.split(".");
        expect(version).toBe("v1");
        const iv = Buffer.from(encodedIv, "base64url");
        const payload = Buffer.from(encodedPayload, "base64url");
        expect(iv).toHaveLength(12);

        const decipher = createDecipheriv("aes-256-gcm", testKey, iv);
        decipher.setAAD(Buffer.from(purpose));
        decipher.setAuthTag(payload.subarray(-16));
        const plaintext = Buffer.concat([
          decipher.update(payload.subarray(0, -16)),
          decipher.final(),
        ]);
        expect(plaintext.toString("utf8")).toBe(value);
      }),
  );

  it.effect("uses a fresh nonce for each encryption of the same credential", () =>
    Effect.gen(function* () {
      const crypto = yield* CryptoService;
      const input = { purpose: cryptoPurpose.emailOutbox, value: "synthetic secret" };
      const first = yield* crypto.encrypt(input);
      const second = yield* crypto.encrypt(input);

      expect(first.split(".")[1]).not.toBe(second.split(".")[1]);
      expect(first).not.toContain(input.value);
      expect(second).not.toContain(input.value);
      expect(yield* crypto.decrypt({ ...input, value: first })).toBe(input.value);
      expect(yield* crypto.decrypt({ ...input, value: second })).toBe(input.value);
    }),
  );

  it.effect("rejects another purpose or encryption key with a typed failure", () =>
    Effect.gen(function* () {
      const crypto = yield* CryptoService;
      const input = { purpose: cryptoPurpose.providerCredential, value: "synthetic secret" };
      const encrypted = yield* crypto.encrypt(input);
      const wrongPurpose = yield* crypto
        .decrypt({
          purpose: cryptoPurpose.emailOutbox,
          value: encrypted,
        })
        .pipe(Effect.flip);
      expect(wrongPurpose).toBeInstanceOf(CryptoError);

      const wrongKey = yield* CryptoService.pipe(Effect.provide(cryptoLayer(Buffer.alloc(32, 1))));
      const wrongKeyError = yield* wrongKey
        .decrypt({ ...input, value: encrypted })
        .pipe(Effect.flip);
      expect(wrongKeyError).toBeInstanceOf(CryptoError);
    }),
  );

  it.effect.each(["nonce", "ciphertext", "tag"] as const)("rejects tampering with the %s", (part) =>
    Effect.gen(function* () {
      const crypto = yield* CryptoService;
      const purpose = cryptoPurpose.providerCredential;
      const encrypted = yield* crypto.encrypt({ purpose, value: "synthetic secret" });
      const [version, encodedIv = "", encodedPayload = ""] = encrypted.split(".");
      const iv = Buffer.from(encodedIv, "base64url");
      const payload = Buffer.from(encodedPayload, "base64url");
      const target = part === "nonce" ? iv : payload;
      const offset = part === "tag" ? target.length - 1 : 0;
      target.writeUInt8(target.readUInt8(offset) ^ 1, offset);

      const value = `${version}.${iv.toString("base64url")}.${payload.toString("base64url")}`;
      const error = yield* crypto.decrypt({ purpose, value }).pipe(Effect.flip);
      expect(error).toBeInstanceOf(CryptoError);
    }),
  );

  it.effect.each(["", "v2.AA.AA", "v1.AA", "v1.AA.AA.extra", "v1..", "v1.AA.AA"])(
    "rejects malformed or unsupported envelopes: %s",
    (value) =>
      Effect.gen(function* () {
        const crypto = yield* CryptoService;
        const error = yield* crypto
          .decrypt({ purpose: cryptoPurpose.emailOutbox, value })
          .pipe(Effect.flip);
        expect(error).toBeInstanceOf(CryptoError);
      }),
  );
});
