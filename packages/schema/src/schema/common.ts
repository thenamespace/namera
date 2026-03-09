import { type PgTimestampConfig, pgRole, timestamp } from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

export const generateUniqueId = () => uuidv7();

export const timestamps = {
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const createTimestampField = (
  name: string,
  config?: PgTimestampConfig<"date">,
) => {
  return timestamp(name, config).defaultNow().notNull();
};

export const userRole = pgRole("app_user", {
  createDb: false,
  createRole: false,
  inherit: true,
}).existing();

export const adminRole = pgRole("app_admin", {
  createDb: true,
  createRole: true,
  inherit: true,
}).existing();
