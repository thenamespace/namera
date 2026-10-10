import { Config } from "effect";

export const OneClawConfig = Config.all({
  platformAppId: Config.String("ONECLAW_PLATFORM_APP_ID"),
  platformApiKey: Config.Redacted("ONECLAW_PLATFORM_API_KEY"),
  emptyTemplateId: Config.String("ONECLAW_EMPTY_TEMPLATE_ID"),
  emptyTemplateVersion: Config.Int("ONECLAW_EMPTY_TEMPLATE_VERSION"),
  baseUrl: Config.String("ONECLAW_API_BASE_URL").pipe(Config.withDefault("https://api.1claw.co")),
  requestTimeout: Config.Duration("ONECLAW_REQUEST_TIMEOUT").pipe(Config.withDefault("30 seconds")),
});

export const OneClawOidcConfig = Config.all({
  issuer: Config.String("ONECLAW_OIDC_ISSUER"),
  audience: Config.String("ONECLAW_OIDC_AUDIENCE"),
  keyId: Config.String("ONECLAW_OIDC_KEY_ID"),
  privateKey: Config.Redacted("ONECLAW_OIDC_PRIVATE_KEY"),
});
