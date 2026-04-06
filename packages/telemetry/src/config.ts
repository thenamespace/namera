import { Config } from "effect";

export const OtelConfig = Config.all({
  otelBaseUrl: Config.url("OTEL_BASE_URL"),
});

export type OtelConfig = Config.Success<typeof OtelConfig>;
