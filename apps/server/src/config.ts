import { Config } from "effect";

export const ServerConfig = Config.all({
  host: Config.String("SERVER_HOST").pipe(Config.withDefault("0.0.0.0")),
  port: Config.Int("SERVER_PORT").pipe(Config.withDefault(8080)),
  corsOrigin: Config.String("SERVER_CORS_ORIGIN").pipe(Config.withDefault("http://localhost:3000")),
  waitlistOrigin: Config.option(Config.URL("WAITLIST_CORS_ORIGIN")),
  adminOrigin: Config.option(Config.URL("ADMIN_CORS_ORIGIN")),
});
