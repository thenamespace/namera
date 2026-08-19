import type {
  ExecutionSubmissionId,
  OrganizationId,
  PolicyId,
  SessionKeyId,
  SessionKeyPolicyReservationId,
  SignatureOperationId,
} from "@namera-ai/protocol";
import type { SessionKeyPolicyReservation } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { organization } from "../auth/organization/organization.js";
import { coreSchema } from "./common.js";
import { executionSubmission } from "./execution-submission.js";
import { sessionKey } from "./session-key.js";
import { signatureOperation } from "./signature-operation.js";

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
    executionSubmissionId: text("execution_submission_id").$type<ExecutionSubmissionId>(),
    signatureOperationId: text("signature_operation_id").$type<SignatureOperationId>(),
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
    uniqueIndex("session_key_policy_reservation_execution_scope_uidx")
      .on(table.organizationId, table.executionSubmissionId, table.policyId, table.stateKey)
      .where(sql`${table.executionSubmissionId} IS NOT NULL`),
    uniqueIndex("session_key_policy_reservation_signature_scope_uidx")
      .on(table.organizationId, table.signatureOperationId, table.policyId, table.stateKey)
      .where(sql`${table.signatureOperationId} IS NOT NULL`),
    foreignKey({
      name: "session_key_policy_reservation_session_key_organization_fk",
      columns: [table.sessionKeyId, table.organizationId],
      foreignColumns: [sessionKey.id, sessionKey.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "session_key_policy_reservation_signature_organization_fk",
      columns: [table.signatureOperationId, table.organizationId],
      foreignColumns: [signatureOperation.id, signatureOperation.organizationId],
    }).onDelete("restrict"),
    check(
      "session_key_policy_reservation_operation_check",
      sql`num_nonnulls(${table.executionSubmissionId}, ${table.signatureOperationId}) = 1`,
    ),
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
