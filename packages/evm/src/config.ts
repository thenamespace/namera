import { Config } from "effect";

export const EvmConfig = Config.all({
  alchemyApiKey: Config.redacted("EVM_ALCHEMY_API_KEY"),
  pimlicoApiKey: Config.redacted("EVM_PIMLICO_API_KEY"),
});

export type EvmConfigValues = Config.Success<typeof EvmConfig>;
