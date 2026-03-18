import { AuthEnvConfig, type AuthEnvValues } from "@namera-ai/auth";
import { DatabaseConfig, type DatabaseEnvValues } from "@namera-ai/database";
import {
  OtelConfig,
  type OtelConfigEnvValues,
} from "@namera-ai/telemetry/backend";
import { Config, ConfigProvider, Context, Layer } from "effect";

const ServerConfig = Config.all({
  alchemyApiKey: Config.redacted("ALCHEMY_API_KEY"),
});

type ServerEnvValues = Config.Config.Success<typeof ServerConfig>;

type EnvValues = DatabaseEnvValues &
  AuthEnvValues &
  OtelConfigEnvValues &
  ServerEnvValues;

const envConfig: Config.Config<EnvValues> = DatabaseConfig.pipe(
  Config.zipWith(AuthEnvConfig, (a, b) => ({ ...a, ...b })),
  Config.zipWith(OtelConfig, (a, b) => ({ ...a, ...b })),
  Config.zipWith(ServerConfig, (a, b) => ({ ...a, ...b })),
);

export class Env extends Context.Tag("Env")<Env, EnvValues>() {}

export const EnvLive = Layer.merge(
  Layer.setConfigProvider(ConfigProvider.fromEnv()),
  Layer.effect(Env, envConfig),
);
