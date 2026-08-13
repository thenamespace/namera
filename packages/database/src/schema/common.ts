import { type PgTimestampConfig, timestamp } from "drizzle-orm/pg-core";

export { generateUniqueId } from "@namera-ai/utils";

export const createTimestampField = (
  name: string,
  config: PgTimestampConfig<"date"> = {
    mode: "date",
    withTimezone: true,
  },
) => {
  return timestamp(name, config);
};

export const timestamps = {
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};
