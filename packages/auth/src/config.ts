import { Config } from "effect";

export const AuthConfig = Config.all({
  baseUrl: Config.string("AUTH_BASE_URL"),
});

export type AuthEnvValues = Config.Config.Success<typeof AuthConfig>;
