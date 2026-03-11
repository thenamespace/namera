import { AuthEnvConfig, type AuthEnvValues } from "@namera-ai/auth";
import { DatabaseConfig, type DatabaseEnvValues } from "@namera-ai/database";
import { OtelConfig, type OtelConfigEnvValues } from "@namera-ai/telemetry";
import { Config, ConfigProvider, Context, Layer } from "effect";

type EnvValues = DatabaseEnvValues & AuthEnvValues & OtelConfigEnvValues;

const envConfig: Config.Config<EnvValues> = DatabaseConfig.pipe(
  Config.zipWith(AuthEnvConfig, (a, b) => ({ ...a, ...b })),
  Config.zipWith(OtelConfig, (a, b) => ({ ...a, ...b })),
);

export class Env extends Context.Tag("Auth")<Env, EnvValues>() {}

export const EnvLive = Layer.merge(
  Layer.setConfigProvider(ConfigProvider.fromEnv()),
  Layer.effect(Env, envConfig),
);
