import { AuthEnvConfig, type AuthEnvValues } from "@repo/auth";
import { DatabaseConfig, type DatabaseEnvValues } from "@repo/database";
import { Config, ConfigProvider, Context, Layer } from "effect";

type EnvValues = DatabaseEnvValues & AuthEnvValues;

const envConfig: Config.Config<EnvValues> = DatabaseConfig.pipe(
  Config.zipWith(AuthEnvConfig, (a, b) => ({ ...a, ...b })),
);

export class Env extends Context.Tag("Auth")<Env, EnvValues>() {}

export const EnvLive = Layer.merge(
  Layer.setConfigProvider(ConfigProvider.fromEnv()),
  Layer.effect(Env, envConfig),
);
