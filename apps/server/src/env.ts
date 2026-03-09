import { DatabaseConfig, type DatabaseEnvValues } from "@repo/database";
import { type Config, ConfigProvider, Context, Layer } from "effect";

type EnvValues = DatabaseEnvValues;

const envConfig: Config.Config<EnvValues> = DatabaseConfig;

export class Env extends Context.Tag("Auth")<Env, EnvValues>() {}

export const EnvLive = Layer.merge(
  Layer.setConfigProvider(ConfigProvider.fromEnv()),
  Layer.effect(Env, envConfig),
);
