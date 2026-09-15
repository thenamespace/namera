import type { BetaInviteEventType } from "@namera-ai/protocol/model";
import { text } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId } from "#/schema/common";

import { betaInvite } from "../auth/core/beta-invite.js";
import { auditSchema } from "./common.js";

// Operator-token actions have no tenant or user actor. Never store the token here.
export const betaInviteEvent = auditSchema.table("beta_invite_events", {
  id: text("id").primaryKey().$defaultFn(generateUniqueId),
  inviteId: text("invite_id")
    .notNull()
    .references(() => betaInvite.id),
  event: text("event").notNull().$type<BetaInviteEventType>(),
  createdAt: createTimestampField("created_at").notNull().defaultNow(),
});
