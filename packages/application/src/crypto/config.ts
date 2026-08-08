import { Config } from "effect";

export const CryptoConfig = Config.all({
  hmacKey: Config.redacted("CRYPTO_HMAC_KEY"),
  encryptionKey: Config.redacted("CRYPTO_ENCRYPTION_KEY"),
});

export type CryptoConfigValue = Config.Success<typeof CryptoConfig>;
