import { Schema } from "effect";

import { SessionKeyGrantId, WalletId } from "#/common/index";
import { EvmSignatureType, SupportedEvmChainId } from "#/evm/index";

export const SignatureCreatedEventData = Schema.Struct({
  event: Schema.Literals(["signature.prepared", "signature.created"]),
  resourceType: Schema.Literal("wallet"),
  resourceId: WalletId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    namespace: Schema.Literal("eip155"),
    chainId: SupportedEvmChainId,
    type: EvmSignatureType,
    sessionKeyGrantId: SessionKeyGrantId,
  }),
});
