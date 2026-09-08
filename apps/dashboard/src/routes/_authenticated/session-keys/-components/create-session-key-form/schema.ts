import { CreateEvmSessionKeyRequest } from "@namera-ai/protocol/dto";

import { OptionalFormDescription } from "@/lib/form-description";

export const CreateSessionKeyFormSchema = CreateEvmSessionKeyRequest.mapFields((fields) => ({
  ...fields,
  metadata: fields.metadata.mapFields((metadata) => ({
    ...metadata,
    description: OptionalFormDescription,
  })),
}));
