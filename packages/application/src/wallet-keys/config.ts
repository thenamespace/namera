import { fileURLToPath } from "node:url";

import { Config } from "effect";

const localWalletKeysDirectory = fileURLToPath(
  new URL("../../../../.data/wallet-keys/", import.meta.url),
);

export const GcpWalletKeysConfig = Config.all({
  projectId: Config.string("GCP_PROJECT_ID"),
  location: Config.string("GCP_KMS_LOCATION").pipe(Config.withDefault("global")),
  keyRing: Config.string("GCP_KMS_KEY_RING"),
});

export const LocalWalletKeysConfig = Config.all({
  directory: Config.string("WALLET_KEYS_LOCAL_DIRECTORY").pipe(
    Config.withDefault(localWalletKeysDirectory),
  ),
});
