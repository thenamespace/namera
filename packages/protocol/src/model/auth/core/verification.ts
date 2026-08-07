import { Schema, Struct } from "effect";

import { VerificationId } from "#/common/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

export const Verification = Schema.Struct({
  id: VerificationId,
  identifier: NonEmptyString,
  value: NonEmptyString,
  expiresAt: Schema.DateTimeUtcFromDate,
}).mapFields(Struct.assign(TimestampFields));

export const VerificationUpdate = createUpdateSchema(Verification);
export const VerificationInsert = createInsertSchema(
  Verification,
  "identifier",
  "value",
  "expiresAt",
);

export type Verification = typeof Verification.Type;
export type VerificationUpdate = typeof VerificationUpdate.Type;
export type VerificationInsert = typeof VerificationInsert.Type;
