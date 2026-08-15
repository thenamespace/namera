import type {
  ExecutionId,
  ExecutionSubmissionId,
  OrganizationId,
  SessionKeyGrantId,
} from "@namera-ai/protocol";
import type { Execution, ExecutionEncoded } from "@namera-ai/protocol/model";
import { foreignKey, index, jsonb, text, unique } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId } from "#/schema/common";

import { organization } from "../auth/organization/organization.js";
import { coreSchema } from "./common.js";
import { executionSubmission } from "./execution-submission.js";
import { sessionKeyGrant } from "./session-key-grant.js";

export const execution = coreSchema.table(
  "execution",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<ExecutionId>(),
    executionSubmissionId: text("execution_submission_id").notNull().$type<ExecutionSubmissionId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    sessionKeyGrantId: text("session_key_grant_id").notNull().$type<SessionKeyGrantId>(),
    namespace: text("namespace").notNull().$type<Execution["namespace"]>(),
    data: jsonb("data").notNull().$type<ExecutionEncoded["data"]>(),
    createdAt: createTimestampField("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("execution_submission_unique").on(table.executionSubmissionId),
    foreignKey({
      name: "execution_submission_match_fk",
      columns: [table.executionSubmissionId, table.sessionKeyGrantId, table.organizationId],
      foreignColumns: [
        executionSubmission.id,
        executionSubmission.sessionKeyGrantId,
        executionSubmission.organizationId,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "execution_session_key_grant_organization_fk",
      columns: [table.sessionKeyGrantId, table.organizationId],
      foreignColumns: [sessionKeyGrant.id, sessionKeyGrant.organizationId],
    }).onDelete("restrict"),
    index("execution_organization_created_at_idx").on(
      table.organizationId,
      table.createdAt,
      table.id,
    ),
    index("execution_session_key_grant_created_at_idx").on(
      table.organizationId,
      table.sessionKeyGrantId,
      table.createdAt,
    ),
  ],
);
