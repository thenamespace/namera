import { Config } from "effect";

export const databaseConfig = {
  database: Config.string("POSTGRES_DATABASE"),
  host: Config.string("POSTGRES_HOST"),
  password: Config.redacted("POSTGRES_PASSWORD"),
  port: Config.number("POSTGRES_PORT"),
  username: Config.string("POSTGRES_USERNAME"),
};

export const adminDatabaseConfig = {
  database: Config.string("POSTGRES_ADMIN_DATABASE"),
  host: Config.string("POSTGRES_ADMIN_HOST"),
  password: Config.redacted("POSTGRES_ADMIN_PASSWORD"),
  port: Config.number("POSTGRES_ADMIN_PORT"),
  username: Config.string("POSTGRES_ADMIN_USERNAME"),
};

export const DatabaseConfig = Config.all(databaseConfig);
export const AdminDatabaseConfig = Config.all(adminDatabaseConfig);
export type DatabaseEnvValues = Config.Success<typeof DatabaseConfig>;
export type AdminDatabaseEnvValues = Config.Success<typeof AdminDatabaseConfig>;
