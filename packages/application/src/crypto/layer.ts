import { Context, Effect, Layer, Redacted } from "effect";

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
const encodeBase64Url = (value: Uint8Array) =>
  btoa(String.fromCharCode(...value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
const decodeBase64Url = (value: string) => {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
};
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
      const webCrypto = globalThis.crypto;
      const hmacSecret = Redacted.value(config.hmacKey);
      const encryptionSecret = Redacted.value(config.encryptionKey);

      if (hmacSecret === encryptionSecret) {
        return yield* new CryptoError({
          reason: "INVALID_CONFIGURATION",
          cause: new Error("HMAC and encryption keys must be different"),
        });
      }

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
        if (!Number.isSafeInteger(byteLength) || byteLength <= 0) {
          return yield* new CryptoError({
            reason: "RANDOM_GENERATION_FAILED",
            cause: new Error("Token byte length must be a positive safe integer"),
          });
        }

        return yield* Effect.try({
          try: () => encodeBase64Url(webCrypto.getRandomValues(new Uint8Array(byteLength))),
          catch: mapCryptoError("RANDOM_GENERATION_FAILED"),
        });
      });

      const randomCode = Effect.fn("CryptoService.randomCode")(function* (digits = 8) {
        if (!Number.isSafeInteger(digits) || digits <= 0) {
          return yield* new CryptoError({
            reason: "RANDOM_GENERATION_FAILED",
            cause: new Error("Code length must be a positive safe integer"),
          });
        }

        return yield* Effect.try({
          try: () => {
            let code = "";

            while (code.length < digits) {
              const bytes = webCrypto.getRandomValues(new Uint8Array(digits - code.length));
              for (const byte of bytes) {
                if (byte < 250 && code.length < digits) {
                  code += String(byte % 10);
                }
              }
            }

            return code;
          },
          catch: mapCryptoError("RANDOM_GENERATION_FAILED"),
        });
      });

      const hash = Effect.fn("CryptoService.hash")(function* (input: CryptoInput) {
        const digest = yield* Effect.tryPromise({
          try: () => webCrypto.subtle.digest("SHA-256", domainSeparatedValue(input)),
          catch: mapCryptoError("HASH_FAILED"),
        });

        return encodeBase64Url(new Uint8Array(digest));
      });

      const hmac = Effect.fn("CryptoService.hmac")(function* (input: CryptoInput) {
        const signature = yield* Effect.tryPromise({
          try: () => webCrypto.subtle.sign("HMAC", hmacKey, domainSeparatedValue(input)),
          catch: mapCryptoError("HMAC_FAILED"),
        });

        return encodeBase64Url(new Uint8Array(signature));
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

        return `${encryptionVersion}.${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(ciphertext))}`;
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
