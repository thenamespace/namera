/** biome-ignore-all lint/nursery/noUndeclaredEnvVars: safe */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dbCredentials: {
    database: "namera",
    host: "localhost",
    password: "postgres",
    port: 5432,
    ssl: false,
    user: "postgres",
  },
  dialect: "postgresql",
  entities: {
    roles: true,
  },
  out: "./migrations",
  schema: "./src/schema/index.ts",
});
