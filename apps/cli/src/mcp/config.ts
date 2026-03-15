import {
  Config,
  Effect,
  Layer,
  Option,
  type Redacted,
  ServiceMap,
} from "effect";

import type { SupportedChain } from "./common";

export type McpConfigShape = {
  getRpcUrl: (
    chain: SupportedChain,
  ) => Effect.Effect<Redacted.Redacted<string> | undefined, Config.ConfigError>;
  getBundlerUrl: (
    chain: SupportedChain,
  ) => Effect.Effect<Redacted.Redacted<string> | undefined, Config.ConfigError>;
  getPaymasterUrl: (
    chain: SupportedChain,
  ) => Effect.Effect<Redacted.Redacted<string> | undefined, Config.ConfigError>;
};

export const McpConfig = ServiceMap.Service<McpConfigShape>("McpConfig");

export const McpConfigLive = Layer.effect(
  McpConfig,
  Effect.gen(function* () {
    return {
      getBundlerUrl: (chain: SupportedChain) =>
        Effect.gen(function* () {
          const envVar = `${chain.toUpperCase()}_BUNDLER_URL`;
          const val = yield* Config.redacted(envVar).pipe(Config.option);
          const url = Option.isSome(val) ? val.value : undefined;
          return url;
        }),
      getPaymasterUrl: (chain: SupportedChain) =>
        Effect.gen(function* () {
          const envVar = `${chain.toUpperCase()}_PAYMASTER_URL`;
          const val = yield* Config.redacted(envVar).pipe(Config.option);
          const url = Option.isSome(val) ? val.value : undefined;
          return url;
        }),
      getRpcUrl: (chain: SupportedChain) =>
        Effect.gen(function* () {
          const envVar = `${chain.toUpperCase()}_RPC_URL`;
          const val = yield* Config.redacted(envVar).pipe(Config.option);
          const url = Option.isSome(val) ? val.value : undefined;
          return url;
        }),
    };
  }),
);
