import { createHash, createHmac } from "node:crypto";

import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { CryptoService, cryptoPurpose } from "../../src/index.js";
import { cryptoLayer, testKey } from "../fixtures/crypto.js";

layer(cryptoLayer())("credential cryptography", (it) => {
  it.effect("matches independent UTF-8 hash and keyed MAC vectors", () =>
    Effect.gen(function* () {
      const crypto = yield* CryptoService;
      const input = { purpose: "auth", value: "Namera 🔐" };

      expect(yield* crypto.sha256("abc")).toBe("ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
      expect(yield* crypto.hash(input)).toBe(
        createHash("sha256").update("4:authNamera 🔐", "utf8").digest("base64url"),
      );
      expect(yield* crypto.hmac(input)).toBe(
        createHmac("sha256", testKey).update("4:authNamera 🔐", "utf8").digest("base64url"),
      );
    }),
  );

  it.effect("separates purposes even when unprefixed concatenations are identical", () =>
    Effect.gen(function* () {
      const crypto = yield* CryptoService;
      const first = { purpose: "a", value: "bc" };
      const second = { purpose: "ab", value: "c" };

      expect(yield* crypto.hash(first)).not.toBe(yield* crypto.hash(second));
      expect(yield* crypto.hmac(first)).not.toBe(yield* crypto.hmac(second));
      expect(
        yield* crypto.hash({ purpose: cryptoPurpose.sessionToken, value: "credential" }),
      ).not.toBe(yield* crypto.hash({ purpose: cryptoPurpose.apiKey, value: "credential" }));
    }),
  );

  it.effect("verifies only the original value, purpose and signing secret", () =>
    Effect.gen(function* () {
      const crypto = yield* CryptoService;
      const input = { purpose: cryptoPurpose.apiKey, value: "synthetic-credential" };
      const expected = yield* crypto.hmac(input);

      expect(yield* crypto.verifyHmac({ ...input, expected })).toBe(true);
      expect(yield* crypto.verifyHmac({ ...input, value: "changed", expected })).toBe(false);
      expect(
        yield* crypto.verifyHmac({ ...input, purpose: cryptoPurpose.sessionToken, expected }),
      ).toBe(false);
      expect(yield* crypto.verifyHmac({ ...input, expected: "AA" })).toBe(false);

      const wrongKey = yield* CryptoService.pipe(Effect.provide(cryptoLayer(Buffer.alloc(32, 1))));
      expect(yield* wrongKey.verifyHmac({ ...input, expected })).toBe(false);
    }),
  );

  it.effect("generates unpadded tokens and exact-length codes using the requested alphabet", () =>
    Effect.gen(function* () {
      const crypto = yield* CryptoService;
      const token = yield* crypto.randomToken();
      const shortToken = yield* crypto.randomToken(18);

      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(token, "base64url")).toHaveLength(32);
      expect(shortToken).toMatch(/^[A-Za-z0-9_-]{24}$/);
      expect(Buffer.from(shortToken, "base64url")).toHaveLength(18);
      expect(yield* crypto.randomCode()).toMatch(/^\d{8}$/);
      expect(yield* crypto.randomCode(6)).toMatch(/^\d{6}$/);
      expect(yield* crypto.randomString("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 12)).toMatch(
        /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$/,
      );
    }),
  );
});
