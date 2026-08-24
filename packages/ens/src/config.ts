import { Config } from "effect";

export const EnsConfig = Config.all({
  apiKey: Config.redacted("NAMERA_ENS_API_KEY"),
});

export type EnsConfigValues = Config.Success<typeof EnsConfig>;
