import type {
  ActorId,
  ExecutionSubmissionId,
  OrganizationId,
  SessionKeyGrantId,
} from "@namera-ai/protocol";
import type { ExecutionSubmission, ExecutionSubmissionEncoded } from "@namera-ai/protocol/model";
import { foreignKey, index, jsonb, text, unique, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { actor } from "../auth/actor.js";
import { organization } from "../auth/organization/organization.js";
import { coreSchema } from "./common.js";
import { sessionKeyGrant } from "./session-key-grant.js";

export const executionSubmission = coreSchema.table(
  "execution_submission",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<ExecutionSubmissionId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    actorId: text("actor_id").notNull().$type<ActorId>(),
    sessionKeyGrantId: text("session_key_grant_id").notNull().$type<SessionKeyGrantId>(),
    namespace: text("namespace").notNull().$type<ExecutionSubmission["namespace"]>(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    policyHash: text("policy_hash").notNull(),
    status: text("status").notNull().default("reserved").$type<ExecutionSubmission["status"]>(),
    data: jsonb("data").notNull().$type<ExecutionSubmissionEncoded["data"]>(),
    leaseExpiresAt: createTimestampField("lease_expires_at"),
    submittedAt: createTimestampField("submitted_at"),
    confirmedAt: createTimestampField("confirmed_at"),
    failedAt: createTimestampField("failed_at"),
    ...timestamps,
  },
  (table) => [
    unique("execution_submission_id_grant_organization_unique").on(
      table.id,
      table.sessionKeyGrantId,
      table.organizationId,
    ),
    foreignKey({
      name: "execution_submission_actor_organization_fk",
      columns: [table.actorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "execution_submission_grant_organization_fk",
      columns: [table.sessionKeyGrantId, table.organizationId],
      foreignColumns: [sessionKeyGrant.id, sessionKeyGrant.organizationId],
    }).onDelete("restrict"),
    uniqueIndex("execution_submission_actor_idempotency_uidx").on(
      table.organizationId,
      table.actorId,
      table.idempotencyKey,
    ),
    index("execution_submission_organization_created_at_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    index("execution_submission_actor_created_at_idx").on(
      table.organizationId,
      table.actorId,
      table.createdAt,
    ),
    index("execution_submission_status_lease_idx").on(table.status, table.leaseExpiresAt),
  ],
);
