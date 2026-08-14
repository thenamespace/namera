import type { CreateSessionKeyRequest } from "@namera-ai/protocol/dto";

export type CreateSessionKeyFormInput = typeof CreateSessionKeyRequest.Encoded;
export type CreateSessionKeyFormValues = typeof CreateSessionKeyRequest.Type;
