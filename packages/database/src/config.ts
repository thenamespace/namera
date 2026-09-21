import { Config } from "effect";

export const databaseConfig = {
  database: Config.String("POSTGRES_DATABASE"),
  host: Config.String("POSTGRES_HOST"),
  port: Config.Number("POSTGRES_PORT"),
  username: Config.String("POSTGRES_USERNAME"),
  password: Config.Redacted("POSTGRES_PASSWORD"),
};

export const DatabaseConfig = Config.all(databaseConfig);
export type DatabaseEnvValues = Config.Success<typeof DatabaseConfig>;
