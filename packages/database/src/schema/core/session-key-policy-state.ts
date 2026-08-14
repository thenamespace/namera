import type {
  OrganizationId,
  PolicyId,
  SessionKeyId,
  SessionKeyPolicyStateId,
} from "@namera-ai/protocol";
import type { SessionKeyPolicyState } from "@namera-ai/protocol/model";
import { foreignKey, integer, jsonb, text, unique } from "drizzle-orm/pg-core";

import { generateUniqueId, timestamps } from "#/schema/common";

import { organization } from "../auth/organization/organization.js";
import { coreSchema } from "./common.js";
import { sessionKey } from "./session-key.js";

export const sessionKeyPolicyState = coreSchema.table(
  "session_key_policy_state",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<SessionKeyPolicyStateId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    sessionKeyId: text("session_key_id").notNull().$type<SessionKeyId>(),
    policyId: text("policy_id").notNull().$type<PolicyId>(),
    stateKey: text("state_key").notNull(),
    stateVersion: integer("state_version").notNull(),
    data: jsonb("data").notNull().$type<SessionKeyPolicyState["data"]>(),
    revision: integer("revision").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    unique("session_key_policy_state_scope_unique").on(
      table.organizationId,
      table.sessionKeyId,
      table.policyId,
      table.stateKey,
    ),
    foreignKey({
      name: "session_key_policy_state_session_key_organization_fk",
      columns: [table.sessionKeyId, table.organizationId],
      foreignColumns: [sessionKey.id, sessionKey.organizationId],
    }).onDelete("restrict"),
  ],
);
