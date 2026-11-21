import { Config, ConfigProvider, Effect, FileSystem, Layer, Option, Path } from "effect";

import { SetupError } from "../errors.ts";
import type { Chain } from "./schema.ts";
import { contractsDir } from "./workspace.ts";

/**
 * Configuration from the process environment, falling back to `contracts/.env` when it exists, so
 * the deployer account, RPC endpoints and verifier keys never need to be passed as flags.
 */
export const layer = Layer.unwrap(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const dotEnv = path.join(contractsDir, ".env");
    const env = ConfigProvider.fromEnv();
    if (!(yield* fs.exists(dotEnv))) return ConfigProvider.layer(env);
    const fileProvider = yield* ConfigProvider.fromDotEnv({ path: dotEnv });
    return ConfigProvider.layer(ConfigProvider.orElse(env, fileProvider));
  }),
);

const optionalConfig = (name: string) =>
  Config.String(name).pipe(
    Config.option,
    Effect.mapError((cause) => SetupError.make({ message: `${name}: ${String(cause)}` })),
  );

/** The RPC endpoint of `chain`: `override`, else its `rpcEnv` variable, else its public RPC. */
export const rpcUrl = Effect.fn("environment.rpcUrl")(function* (
  chain: Chain,
  override: Option.Option<string>,
) {
  if (Option.isSome(override)) return override.value;
  const configured = yield* optionalConfig(chain.rpcEnv);
  return Option.getOrElse(configured, () => chain.publicRpc);
});

/** The `cast wallet` keystore that signs deployments. */
export const deployerAccount = optionalConfig("DEPLOYER_ACCOUNT").pipe(
  Effect.flatMap(
    Option.match({
      onNone: () =>
        Effect.fail(
          SetupError.make({ message: "DEPLOYER_ACCOUNT is not set (a cast wallet keystore)" }),
        ),
      onSome: Effect.succeed,
    }),
  ),
);

/** The Etherscan V2 API key, if set. */
export const etherscanApiKey = optionalConfig("ETHERSCAN_API_KEY").pipe(
  Effect.map(Option.filter((key) => key.length > 0)),
);
