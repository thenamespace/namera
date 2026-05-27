import { Config } from "effect";

export const databaseConfig = {
  database: Config.string("POSTGRES_DATABASE"),
  host: Config.string("POSTGRES_HOST"),
  port: Config.number("POSTGRES_PORT"),
  username: Config.string("POSTGRES_APP_USER_USERNAME"),
  password: Config.redacted("POSTGRES_APP_USER_PASSWORD"),
};

export const adminDatabaseConfig = {
  database: Config.string("POSTGRES_DATABASE"),
  host: Config.string("POSTGRES_HOST"),
  port: Config.number("POSTGRES_PORT"),
  username: Config.string("POSTGRES_APP_ADMIN_USERNAME"),
  password: Config.redacted("POSTGRES_APP_ADMIN_PASSWORD"),
};

export const DatabaseConfig = Config.all(databaseConfig);
export const AdminDatabaseConfig = Config.all(adminDatabaseConfig);
export type DatabaseEnvValues = Config.Success<typeof DatabaseConfig>;
export type AdminDatabaseEnvValues = Config.Success<typeof AdminDatabaseConfig>;
