import { Schema, Struct } from "effect";

import { OrganizationId, PolicyId, SessionKeyId, SessionKeyPolicyStateId } from "#/common/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

export const SessionKeyPolicyState = Schema.Struct({
  id: SessionKeyPolicyStateId,
  organizationId: OrganizationId,
  sessionKeyId: SessionKeyId,
  policyId: PolicyId,
  stateKey: NonEmptyString,
  stateVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  data: Schema.Json,
  revision: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
}).mapFields(Struct.assign(TimestampFields));

export const SessionKeyPolicyStateInsert = createInsertSchema(
  SessionKeyPolicyState,
  "organizationId",
  "sessionKeyId",
  "policyId",
  "stateKey",
  "stateVersion",
  "data",
);

export type SessionKeyPolicyState = typeof SessionKeyPolicyState.Type;
export type SessionKeyPolicyStateInsert = typeof SessionKeyPolicyStateInsert.Type;
