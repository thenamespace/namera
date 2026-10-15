import { NodeCrypto } from "@effect/platform-node";
import { ConfigProvider, Layer } from "effect";

import { CryptoService } from "../../src/index.js";

// Public synthetic key bytes, used only in isolated test layers.
export const testKey = Buffer.from("0123456789abcdef0123456789abcdef", "utf8");

export const cryptoLayer = (key: Uint8Array = testKey) =>
  Layer.fresh(CryptoService.layer).pipe(
    Layer.provide(NodeCrypto.layer),
    Layer.provide(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({
          CRYPTO_HMAC_KEY: Buffer.from(key).toString("base64url"),
          CRYPTO_ENCRYPTION_KEY: Buffer.from(key).toString("base64url"),
        }),
      ),
    ),
  );
