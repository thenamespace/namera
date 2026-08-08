/** biome-ignore-all lint/nursery/noUndeclaredEnvVars: safe */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dbCredentials: {
    database: process.env.POSTGRES_DATABASE ?? "namera",
    host: process.env.POSTGRES_HOST ?? "localhost",
    password: process.env.POSTGRES_PASSWORD ?? "postgres",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    ssl: false,
    user: process.env.POSTGRES_USERNAME ?? "postgres",
  },
  dialect: "postgresql",
  entities: {
    roles: true,
  },
  out: "./migrations",
  schema: "./src/schema/index.ts",
});
