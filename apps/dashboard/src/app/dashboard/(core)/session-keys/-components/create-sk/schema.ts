import { Schema } from "effect";

import { SessionKeyMetadata, SupportedChain } from "@namera-ai/schema";

export const NewSessionKeyFormSchema = Schema.Struct({
  metadata: SessionKeyMetadata,
  chains: Schema.Array(SupportedChain),
});

export type NewSessionKeyFormSchema = typeof NewSessionKeyFormSchema.Type;
