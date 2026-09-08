import { Schema } from "effect";

import {
  SessionKeyId,
  WalletId,
  SessionKeyInstallationId,
  SessionKeyOperationId,
} from "#/common/index";
import { SupportedEvmChainId } from "#/evm/chains";

export const SessionKeyOperationEventData = Schema.Struct({
  event: Schema.Literals([
    "session_key.operation_prepared",
    "session_key.operation_approved",
    "session_key.operation_confirmed",
    "session_key.operation_failed",
  ]),
  resourceType: Schema.Literal("session-key"),
  resourceId: SessionKeyId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    installationId: SessionKeyInstallationId,
    operationId: SessionKeyOperationId,
    chainId: SupportedEvmChainId,
    kind: Schema.Literals(["install", "uninstall"]),
  }),
});

export const SessionKeyCreatedEventData = Schema.Struct({
  event: Schema.Literal("session_key.created"),
  resourceType: Schema.Literal("session-key"),
  resourceId: SessionKeyId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    walletId: WalletId,
    namespace: Schema.Literal("eip155"),
    policyTypes: Schema.Array(
      Schema.Literals([
        "evm.chain-allowlist",
        "evm.gas-budget",
        "evm.native-spend-limit",
        "evm.signature",
        "evm.time-window",
      ]),
    ),
  }),
});

export const SessionKeyRevokedEventData = Schema.Struct({
  event: Schema.Literals(["session_key.revocation_requested", "session_key.revoked"]),
  resourceType: Schema.Literal("session-key"),
  resourceId: SessionKeyId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    walletId: WalletId,
    namespace: Schema.Literal("eip155"),
    revokedGrantCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
});
