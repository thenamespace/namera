import { Schema, Struct } from "effect";

import { ActorId, OrganizationId, WalletId, WalletKeyId } from "#/common/index";
import { MetadataDescription, MetadataLogo, MetadataName, TimestampFields } from "#/model/common";

export const WalletStatus = Schema.Literals(["active", "frozen", "archived"]);
export const WalletMetadata = Schema.Struct({
  version: Schema.Literal(1),
  name: MetadataName,
  logo: Schema.optionalKey(MetadataLogo),
  description: Schema.optionalKey(MetadataDescription),
});

export const WalletCommon = Schema.Struct({
  id: WalletId,
  organizationId: OrganizationId,
  walletKeyId: WalletKeyId,
  metadata: WalletMetadata,
  status: WalletStatus,
  createdByActorId: ActorId,
}).mapFields(Struct.assign(TimestampFields));

export type WalletStatus = typeof WalletStatus.Type;
export type WalletMetadata = typeof WalletMetadata.Type;
