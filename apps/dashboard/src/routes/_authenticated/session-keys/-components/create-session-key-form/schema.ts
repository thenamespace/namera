import { Schema } from "effect";

import { CreateEvmSessionKeyRequest } from "@namera-ai/protocol/dto";

import { isChainOperationEnabled } from "@/lib/chain-availability";
import { OptionalFormDescription } from "@/lib/form-description";

export const CreateSessionKeyFormSchema = CreateEvmSessionKeyRequest.mapFields((fields) => ({
  ...fields,
  metadata: fields.metadata.mapFields((metadata) => ({
    ...metadata,
    description: OptionalFormDescription,
  })),
})).check(
  Schema.makeFilter((request) =>
    request.onchain.chains.every(isChainOperationEnabled)
      ? undefined
      : { path: ["onchain", "chains"], issue: "Choose networks that are not paused." },
  ),
);
