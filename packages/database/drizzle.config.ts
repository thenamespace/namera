/** biome-ignore-all lint/nursery/noUndeclaredEnvVars: safe */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dbCredentials: {
    database: process.env.POSTGRES_DATABASE as string,
    host: process.env.POSTGRES_HOST as string,
    password: process.env.POSTGRES_PASSWORD as string,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USERNAME as string,
  },
  dialect: "postgresql",
  out: "./migrations",
  schema: "../schema/src/schema",
});
