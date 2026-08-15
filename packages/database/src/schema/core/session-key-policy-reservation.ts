import type {
  ExecutionSubmissionId,
  OrganizationId,
  PolicyId,
  SessionKeyId,
  SessionKeyPolicyReservationId,
} from "@namera-ai/protocol";
import type { SessionKeyPolicyReservation } from "@namera-ai/protocol/model";
import { foreignKey, index, integer, jsonb, text, unique } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { organization } from "../auth/organization/organization.js";
import { coreSchema } from "./common.js";
import { executionSubmission } from "./execution-submission.js";
import { sessionKey } from "./session-key.js";

export const sessionKeyPolicyReservation = coreSchema.table(
  "session_key_policy_reservation",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<SessionKeyPolicyReservationId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    sessionKeyId: text("session_key_id").notNull().$type<SessionKeyId>(),
    policyId: text("policy_id").notNull().$type<PolicyId>(),
    executionSubmissionId: text("execution_submission_id").notNull().$type<ExecutionSubmissionId>(),
    stateKey: text("state_key").notNull(),
    reservationVersion: integer("reservation_version").notNull(),
    data: jsonb("data").notNull().$type<SessionKeyPolicyReservation["data"]>(),
    status: text("status")
      .notNull()
      .default("reserved")
      .$type<SessionKeyPolicyReservation["status"]>(),
    expiresAt: createTimestampField("expires_at").notNull(),
    submittedAt: createTimestampField("submitted_at"),
    settledAt: createTimestampField("settled_at"),
    releasedAt: createTimestampField("released_at"),
    ...timestamps,
  },
  (table) => [
    unique("session_key_policy_reservation_submission_scope_unique").on(
      table.organizationId,
      table.executionSubmissionId,
      table.policyId,
      table.stateKey,
    ),
    foreignKey({
      name: "session_key_policy_reservation_session_key_organization_fk",
      columns: [table.sessionKeyId, table.organizationId],
      foreignColumns: [sessionKey.id, sessionKey.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "session_key_policy_reservation_submission_organization_fk",
      columns: [table.executionSubmissionId, table.organizationId],
      foreignColumns: [executionSubmission.id, executionSubmission.organizationId],
    }).onDelete("restrict"),
    index("session_key_policy_reservation_session_status_idx").on(
      table.organizationId,
      table.sessionKeyId,
      table.status,
    ),
    index("session_key_policy_reservation_status_expiry_idx").on(table.status, table.expiresAt),
  ],
);
