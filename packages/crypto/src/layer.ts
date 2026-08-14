import { Context, Crypto, Effect, Layer, Redacted } from "effect";

import { CryptoError } from "@namera-ai/protocol";
import { Base64 } from "@namera-ai/utils";

import { CryptoConfig } from "./config.js";

type CryptoInput = {
  readonly purpose: string;
  readonly value: string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const encryptionVersion = "v1";

const encodeText = (value: string) => textEncoder.encode(value);
const decodeBase64Url = (value: string) => new Uint8Array(Base64.toUint8Array(value));
const domainSeparatedValue = ({ purpose, value }: CryptoInput) =>
  encodeText(`${purpose.length}:${purpose}${value}`);

export class CryptoService extends Context.Service<
  CryptoService,
  {
    readonly randomToken: (byteLength?: number) => Effect.Effect<string>;
    readonly randomCode: (digits?: number) => Effect.Effect<string>;
    readonly hash: (input: CryptoInput) => Effect.Effect<string>;
    readonly hmac: (input: CryptoInput) => Effect.Effect<string>;
    readonly verifyHmac: (
      input: CryptoInput & { readonly expected: string },
    ) => Effect.Effect<boolean>;
    readonly encrypt: (input: CryptoInput) => Effect.Effect<string>;
    readonly decrypt: (input: CryptoInput) => Effect.Effect<string, CryptoError>;
  }
>()("@namera-ai/crypto/CryptoService") {
  static readonly layer = Layer.effect(
    CryptoService,
    Effect.gen(function* () {
      const config = yield* CryptoConfig;
      const platformCrypto = yield* Crypto.Crypto;
      const webCrypto = globalThis.crypto;
      const hmacSecret = Redacted.value(config.hmacKey);
      const encryptionSecret = Redacted.value(config.encryptionKey);

      const [hmacKey, encryptionKey] = yield* Effect.all([
        Effect.promise(() =>
          webCrypto.subtle.importKey(
            "raw",
            decodeBase64Url(hmacSecret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign", "verify"],
          ),
        ),
        Effect.promise(() =>
          webCrypto.subtle.importKey(
            "raw",
            decodeBase64Url(encryptionSecret),
            { name: "AES-GCM" },
            false,
            ["encrypt", "decrypt"],
          ),
        ),
      ]);

      const randomToken = Effect.fnUntraced(function* (byteLength = 32) {
        const bytes = yield* platformCrypto.randomBytes(byteLength).pipe(Effect.orDie);
        return Base64.fromUint8Array(bytes, true);
      });

      const randomCode = Effect.fnUntraced(function* (digits = 8) {
        const values = yield* Effect.all(
          Array.from({ length: digits }, () => platformCrypto.randomIntBetween(0, 9)),
        );
        return values.join("");
      });

      const hash = Effect.fnUntraced(function* (input: CryptoInput) {
        const digest = yield* platformCrypto
          .digest("SHA-256", domainSeparatedValue(input))
          .pipe(Effect.orDie);
        return Base64.fromUint8Array(digest, true);
      });

      const hmac = Effect.fnUntraced(function* (input: CryptoInput) {
        const signature = yield* Effect.promise(() =>
          webCrypto.subtle.sign("HMAC", hmacKey, domainSeparatedValue(input)),
        );
        return Base64.fromUint8Array(new Uint8Array(signature), true);
      });

      const verifyHmac = Effect.fnUntraced(function* (
        input: CryptoInput & { readonly expected: string },
      ) {
        return yield* Effect.promise(() =>
          webCrypto.subtle.verify(
            "HMAC",
            hmacKey,
            decodeBase64Url(input.expected),
            domainSeparatedValue(input),
          ),
        );
      });

      const encrypt = Effect.fnUntraced(function* (input: CryptoInput) {
        const iv = webCrypto.getRandomValues(new Uint8Array(12));
        const ciphertext = yield* Effect.promise(() =>
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
        );

        return `${encryptionVersion}.${Base64.fromUint8Array(iv, true)}.${Base64.fromUint8Array(new Uint8Array(ciphertext), true)}`;
      });

      const decrypt = Effect.fnUntraced(function* (input: CryptoInput) {
        const parts = input.value.split(".");
        const [version, encodedIv, encodedCiphertext] = parts;
        if (
          parts.length !== 3 ||
          version !== encryptionVersion ||
          encodedIv === undefined ||
          encodedCiphertext === undefined
        ) {
          return yield* new CryptoError({ cause: new Error("Unsupported encrypted payload") });
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
          catch: (cause) => new CryptoError({ cause }),
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
