import { NameraClient as UniversalNameraClient } from "./client.js";
import { NAMERA_API_ORIGIN } from "./defaults.js";
import { createNodeSessionSigner } from "./node/default-resolver.js";
import type { NameraClientConfig } from "./transport.js";

export * from "./index.js";

export class NameraClient extends UniversalNameraClient {
  constructor(config: NameraClientConfig) {
    super({
      ...config,
      ...(config.resolveSessionSigner === undefined && config.localSigning !== false
        ? {
            resolveSessionSigner: createNodeSessionSigner(
              new URL(config.baseUrl ?? NAMERA_API_ORIGIN).origin,
              config.maxGasCostWei,
            ),
          }
        : {}),
    });
  }
}
