import { Schema, Struct } from "effect";

import { ActorId, ApiKeyId, OrganizationId } from "#/common/index";
import { MetadataDescription, MetadataLogo, MetadataName, TimestampFields } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

export const ApiKeyMetadata = Schema.Struct({
  version: Schema.Literal(1),
  name: MetadataName,
  logo: Schema.optionalKey(MetadataLogo),
  description: Schema.optionalKey(MetadataDescription),
});

export const ApiKey = Schema.Struct({
  id: ApiKeyId,
  organizationId: OrganizationId,
  actorId: ActorId,
  createdByActorId: ActorId,
  metadata: ApiKeyMetadata,
  keyHash: Schema.NonEmptyString,
  keyStart: Schema.NonEmptyString,
  expiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  lastUsedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedByActorId: Schema.NullOr(ActorId),
}).mapFields(Struct.assign(TimestampFields));

export const ApiKeyInsert = createInsertSchema(
  ApiKey,
  "organizationId",
  "actorId",
  "createdByActorId",
  "metadata",
  "keyHash",
  "keyStart",
  "expiresAt",
);

export type ApiKeyMetadata = typeof ApiKeyMetadata.Type;
export type ApiKey = typeof ApiKey.Type;
export type ApiKeyInsert = typeof ApiKeyInsert.Type;
