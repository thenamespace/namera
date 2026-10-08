import type { PlatformEventData } from "@namera-ai/protocol/model";
import { index, jsonb, text } from "drizzle-orm/pg-core";

import { platformMember } from "#/schema/auth/platform";
import { createTimestampField, generateUniqueId } from "#/schema/common";

import { auditSchema } from "./common.js";

export const platformEvent = auditSchema.table(
  "platform_events",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId),
    actorMemberId: text("actor_member_id").references(() => platformMember.id),
    data: jsonb("data").$type<PlatformEventData>().notNull(),
    createdAt: createTimestampField("created_at").notNull().defaultNow(),
  },
  (t) => [index("platform_events_actor_created_idx").on(t.actorMemberId, t.createdAt)],
);
