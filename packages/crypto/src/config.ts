import { Config } from "effect";

export const CryptoConfig = Config.all({
  hmacKey: Config.Redacted("CRYPTO_HMAC_KEY"),
  encryptionKey: Config.Redacted("CRYPTO_ENCRYPTION_KEY"),
});
