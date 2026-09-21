import { fileURLToPath } from "node:url";

import { Config } from "effect";

const localWalletKeysDirectory = fileURLToPath(
  new URL("../../../.data/wallet-keys/", import.meta.url),
);

export const GcpWalletKeysConfig = Config.all({
  projectId: Config.String("GCP_PROJECT_ID"),
  location: Config.String("GCP_KMS_LOCATION").pipe(Config.withDefault("global")),
  keyRing: Config.String("GCP_KMS_KEY_RING"),
});

export const LocalWalletKeysConfig = Config.all({
  directory: Config.String("WALLET_KEYS_LOCAL_DIRECTORY").pipe(
    Config.withDefault(localWalletKeysDirectory),
  ),
});
