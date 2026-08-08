import { Context, Crypto, Effect, Layer, Redacted } from "effect";

import { Base64 } from "@namera-ai/utils";

import { CryptoConfig } from "./config.js";
import {
  CryptoError,
  type CryptoInput,
  type CryptoServiceValue,
  type CryptoVerificationInput,
} from "./types.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const encryptionVersion = "v1";

const encodeText = (value: string) => textEncoder.encode(value);
const decodeBase64Url = (value: string) => new Uint8Array(Base64.toUint8Array(value));
const domainSeparatedValue = ({ purpose, value }: CryptoInput) =>
  encodeText(`${purpose.length}:${purpose}${value}`);

const mapCryptoError = (reason: CryptoError["reason"]) => (cause: unknown) =>
  new CryptoError({ reason, cause });

export class CryptoService extends Context.Service<CryptoService, CryptoServiceValue>()(
  "@namera-ai/application/CryptoService",
) {
  static readonly layer = Layer.effect(
    CryptoService,
    Effect.gen(function* () {
      const config = yield* CryptoConfig;
      const platformCrypto = yield* Crypto.Crypto;
      const webCrypto = globalThis.crypto;
      const hmacSecret = Redacted.value(config.hmacKey);
      const encryptionSecret = Redacted.value(config.encryptionKey);

      const [hmacKey, encryptionKey] = yield* Effect.all([
        Effect.tryPromise({
          try: () =>
            webCrypto.subtle.importKey(
              "raw",
              decodeBase64Url(hmacSecret),
              { name: "HMAC", hash: "SHA-256" },
              false,
              ["sign", "verify"],
            ),
          catch: mapCryptoError("HMAC_FAILED"),
        }),
        Effect.tryPromise({
          try: () =>
            webCrypto.subtle.importKey(
              "raw",
              decodeBase64Url(encryptionSecret),
              { name: "AES-GCM" },
              false,
              ["encrypt", "decrypt"],
            ),
          catch: mapCryptoError("ENCRYPTION_FAILED"),
        }),
      ]);

      const randomToken = Effect.fn("CryptoService.randomToken")(function* (byteLength = 32) {
        const bytes = yield* platformCrypto
          .randomBytes(byteLength)
          .pipe(Effect.mapError(mapCryptoError("RANDOM_GENERATION_FAILED")));

        return Base64.fromUint8Array(bytes, true);
      });

      const randomCode = Effect.fn("CryptoService.randomCode")(function* (digits = 8) {
        const values = yield* Effect.all(
          Array.from({ length: digits }, () => platformCrypto.randomIntBetween(0, 9)),
        );

        return values.join("");
      });

      const hash = Effect.fn("CryptoService.hash")(function* (input: CryptoInput) {
        const digest = yield* platformCrypto
          .digest("SHA-256", domainSeparatedValue(input))
          .pipe(Effect.mapError(mapCryptoError("HASH_FAILED")));

        return Base64.fromUint8Array(digest, true);
      });

      const hmac = Effect.fn("CryptoService.hmac")(function* (input: CryptoInput) {
        const signature = yield* Effect.tryPromise({
          try: () => webCrypto.subtle.sign("HMAC", hmacKey, domainSeparatedValue(input)),
          catch: mapCryptoError("HMAC_FAILED"),
        });

        return Base64.fromUint8Array(new Uint8Array(signature), true);
      });

      const verifyHmac = Effect.fn("CryptoService.verifyHmac")(function* (
        input: CryptoVerificationInput,
      ) {
        return yield* Effect.tryPromise({
          try: () =>
            webCrypto.subtle.verify(
              "HMAC",
              hmacKey,
              decodeBase64Url(input.expected),
              domainSeparatedValue(input),
            ),
          catch: mapCryptoError("HMAC_FAILED"),
        });
      });

      const encrypt = Effect.fn("CryptoService.encrypt")(function* (input: CryptoInput) {
        const iv = yield* Effect.try({
          try: () => webCrypto.getRandomValues(new Uint8Array(12)),
          catch: mapCryptoError("RANDOM_GENERATION_FAILED"),
        });
        const ciphertext = yield* Effect.tryPromise({
          try: () =>
            webCrypto.subtle.encrypt(
              {
                name: "AES-GCM",
                iv,
                additionalData: encodeText(input.purpose),
                tagLength: 128,
              },
              encryptionKey,
              encodeText(input.value),
            ),
          catch: mapCryptoError("ENCRYPTION_FAILED"),
        });

        return `${encryptionVersion}.${Base64.fromUint8Array(iv, true)}.${Base64.fromUint8Array(new Uint8Array(ciphertext), true)}`;
      });

      const decrypt = Effect.fn("CryptoService.decrypt")(function* (input: CryptoInput) {
        const parts = input.value.split(".");
        const [version, encodedIv, encodedCiphertext] = parts;
        if (
          parts.length !== 3 ||
          version !== encryptionVersion ||
          encodedIv === undefined ||
          encodedCiphertext === undefined
        ) {
          return yield* new CryptoError({
            reason: "DECRYPTION_FAILED",
            cause: new Error("Unsupported encrypted payload"),
          });
        }

        const plaintext = yield* Effect.tryPromise({
          try: () =>
            webCrypto.subtle.decrypt(
              {
                name: "AES-GCM",
                iv: decodeBase64Url(encodedIv),
                additionalData: encodeText(input.purpose),
                tagLength: 128,
              },
              encryptionKey,
              decodeBase64Url(encodedCiphertext),
            ),
          catch: mapCryptoError("DECRYPTION_FAILED"),
        });

        return textDecoder.decode(plaintext);
      });

      return CryptoService.of({
        randomToken,
        randomCode,
        hash,
        hmac,
        verifyHmac,
        encrypt,
        decrypt,
      });
    }),
  );
}
