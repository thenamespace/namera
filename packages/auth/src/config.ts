import { Config, type Redacted } from "effect";

export type AuthConfigValues = {
  readonly baseUrl: string;
  readonly githubClientId: string;
  readonly githubClientSecret: Redacted.Redacted<string>;
  readonly googleClientId: string;
  readonly googleClientSecret: Redacted.Redacted<string>;
  readonly secret: Redacted.Redacted<string>;
};
export const AuthConfig = Config.all({
  baseUrl: Config.string("AUTH_BASE_URL"),
  secret: Config.redacted("AUTH_SECRET"),
});
