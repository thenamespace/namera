import { Result, Schema, Struct } from "effect";

import { ActorId, ApiKeyId, OrganizationId } from "#/common/index";
import { MetadataDescription, MetadataLogo, MetadataName, TimestampFields } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

export const ApiKeyPermission = Schema.Literals([
  "wallet:read",
  "wallet:create",
  "session-key:read",
  "session-key:create",
  "session-key:install",
  "session-key:uninstall",
  "session-key:revoke",
]);

export const ApiKeyPasskeyOrigin = Schema.NonEmptyString.check(
  Schema.makeFilter((value) => {
    const parsed = Schema.decodeUnknownResult(Schema.URLFromString)(value);
    if (Result.isFailure(parsed)) return "Invalid passkey origin";
    const url = parsed.success;
    return url.origin === value &&
      !url.username &&
      !url.password &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
      ? undefined
      : "Use an exact HTTPS origin, or HTTP localhost for development";
  }),
);

export type ApiKeyPermission = typeof ApiKeyPermission.Type;

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
  permissions: Schema.Array(ApiKeyPermission),
  passkeyOrigins: Schema.Array(ApiKeyPasskeyOrigin),
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
