import { Config } from "effect";

export const EvmConfig = Config.all({
  alchemyApiKey: Config.redacted("EVM_ALCHEMY_API_KEY"),
  alchemyBsoPolicyId: Config.redacted("EVM_ALCHEMY_BSO_POLICY_ID"),
  blockscoutApiKey: Config.redacted("BLOCKSCOUT_API_KEY"),
});

export type EvmConfigValues = Config.Success<typeof EvmConfig>;
