import { SQL, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  type PgTimestampConfig,
  pgRole,
  timestamp,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

export const generateUniqueId = () => uuidv7();

export const createTimestampField = (
  name: string,
  config?: PgTimestampConfig<"date">,
) => {
  return timestamp(name, config);
};

export const timestamps = {
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  deletedAt: timestamp("deleted_at", {
    mode: "date",
    withTimezone: true,
  }).default(sql`NULL`),
};

export const lower = (value: AnyPgColumn): SQL => {
  return sql`lower(${value})`;
};

export const userRole = pgRole("app_user").existing();
export const adminRole = pgRole("app_admin").existing();
