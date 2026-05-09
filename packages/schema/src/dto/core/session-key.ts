import { Schema } from "effect";

import { SmartAccountId, SupportedChain } from "@/common";
import { SessionKeyMetadata } from "@/core";

export const CreateSessionKeyRequest = Schema.Struct({
  metadata: SessionKeyMetadata,
  smartAccountId: SmartAccountId,
  chains: Schema.Array(SupportedChain),
});
