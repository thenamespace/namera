import { fileURLToPath } from "node:url";

import { Config } from "effect";
// Preserve the pre-split source and unbundled-dist key directory.
const directory = fileURLToPath(new URL("../../../../.data/wallet-keys/", import.meta.url));

export const LocalConfig = Config.all({
  directory: Config.String("WALLET_KEYS_LOCAL_DIRECTORY").pipe(Config.withDefault(directory)),
});
