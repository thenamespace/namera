import { Schema } from "effect";

import { VerificationId } from "@/common";
import { createInsertSchema, createUpdateSchema } from "@/helpers";

export const Verification = Schema.Struct({
  id: VerificationId,
  identifier: Schema.String,
  value: Schema.String,
  expiresAt: Schema.Date,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  deletedAt: Schema.NullOr(Schema.Date),
});

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
