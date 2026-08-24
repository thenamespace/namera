import { Config } from "effect";

export const EnsConfig = Config.all({
  apiKey: Config.redacted("NAMERA_ID_OFFCHAIN_API_KEY"),
});

export type EnsConfigValues = Config.Success<typeof EnsConfig>;
