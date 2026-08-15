import { Schema } from "effect";

import { SessionKeyId, WalletId } from "#/common/index";

export const SessionKeyCreatedEventData = Schema.Struct({
  event: Schema.Literal("session_key.created"),
  resourceType: Schema.Literal("session-key"),
  resourceId: SessionKeyId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    walletId: WalletId,
    namespace: Schema.Literal("eip155"),
    policyTypes: Schema.Array(
      Schema.Literals(["evm.native-spend-limit", "evm.signature", "evm.time-window"]),
    ),
  }),
});

export const SessionKeyRevokedEventData = Schema.Struct({
  event: Schema.Literal("session_key.revoked"),
  resourceType: Schema.Literal("session-key"),
  resourceId: SessionKeyId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    walletId: WalletId,
    namespace: Schema.Literal("eip155"),
    revokedGrantCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
});
