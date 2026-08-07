import { Config } from "effect";

export const databaseConfig = {
  database: Config.string("POSTGRES_DATABASE"),
  host: Config.string("POSTGRES_HOST"),
  port: Config.number("POSTGRES_PORT"),
  username: Config.string("POSTGRES_USERNAME"),
  password: Config.redacted("POSTGRES_PASSWORD"),
};

export const DatabaseConfig = Config.all(databaseConfig);
export type DatabaseEnvValues = Config.Success<typeof DatabaseConfig>;
