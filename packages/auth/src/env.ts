import { Config } from "effect";

export const AuthEnv = Config.all({
  baseURL: Config.url("AUTH_BASE_URL"),
  isProd: Config.boolean("IS_PROD"),
});

export type AuthEnv = Config.Success<typeof AuthEnv>;
