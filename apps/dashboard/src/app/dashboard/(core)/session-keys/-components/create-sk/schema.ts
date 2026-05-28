import { Schema } from "effect";

import { SupportedChain } from "@namera-ai/schema";

export const NewSessionKeyFormSchema = Schema.Struct({
  metadata: Schema.Any,
  chains: Schema.Array(SupportedChain),
});

export type NewSessionKeyFormSchema = typeof NewSessionKeyFormSchema.Type;
