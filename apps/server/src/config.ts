import { Config } from "effect";

export const ServerConfig = Config.all({
  host: Config.string("SERVER_HOST").pipe(Config.withDefault("0.0.0.0")),
  port: Config.int("SERVER_PORT").pipe(Config.withDefault(8080)),
  corsOrigin: Config.string("SERVER_CORS_ORIGIN").pipe(Config.withDefault("http://localhost:3000")),
});
