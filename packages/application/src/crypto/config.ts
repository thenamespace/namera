import { Config, Redacted, Schema } from "effect";

const CryptoKey = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9_-]{43}$/, {
    message: "Cryptographic keys must be 32-byte unpadded base64url values",
  }),
);

const redactedCryptoKey = (name: string) =>
  Config.schema(CryptoKey, name).pipe(Config.map((value) => Redacted.make(value, { label: name })));

export const CryptoConfig = Config.all({
  hmacKey: redactedCryptoKey("CRYPTO_HMAC_KEY"),
  encryptionKey: redactedCryptoKey("CRYPTO_ENCRYPTION_KEY"),
});

export type CryptoConfigValue = Config.Success<typeof CryptoConfig>;
