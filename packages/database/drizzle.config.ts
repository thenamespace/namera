/** biome-ignore-all lint/nursery/noUndeclaredEnvVars: safe */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dbCredentials: {
    database: "namera",
    host: "localhost",
    password: "namera",
    port: 5432,
    ssl: false,
    user: "namera",
  },
  dialect: "postgresql",
  entities: {
    roles: true,
  },
  out: "./drizzle-migrations",
  schema: "./src/schema/index.ts",
});
