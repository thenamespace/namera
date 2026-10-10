import { Schema, Struct } from "effect";

import {
  SessionKeyId,
  SessionKeyInstallationId,
  SignatureOperationId,
  SigningKeyId,
} from "#/common/index";
import { EvmTypedData, Hex } from "#/evm/index";

import { SignEvmMessageRequest, SignEvmTypedDataRequest, SignResponse } from "./signature.js";

export const PrepareSignatureRequest = Schema.Union(
  [
    Schema.Struct({ ...SignEvmMessageRequest.fields, sessionKeyId: SessionKeyId }),
    Schema.Struct({ ...SignEvmTypedDataRequest.fields, sessionKeyId: SessionKeyId }),
  ],
  { mode: "oneOf" },
).annotate({
  identifier: "PrepareSignatureRequest",
  description:
    "Prepare a message or typed-data signature for one explicitly granted, installed local session. Never send private key material.",
});

export const PrepareSignatureResponse = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  operationId: SignatureOperationId,
  installationId: SessionKeyInstallationId,
  signingKeyId: SigningKeyId,
  request: PrepareSignatureRequest,
  signing: Schema.Struct({
    method: Schema.Literal("eth_signTypedData_v4"),
    typedData: EvmTypedData,
  }),
  expiresAt: Schema.DateTimeUtcFromDate,
}).annotate({
  identifier: "PrepareSignatureResponse",
  description:
    "Reserved signature operation and replay-safe EIP-712 challenge. The client must recompute the challenge from its wallet/session binding and original payload before signing locally.",
});

export const CompleteSignatureRequest = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  operationId: SignatureOperationId,
  signature: Hex.check(Schema.isPattern(/^0x[0-9a-fA-F]{130}$/)).annotate({
    description:
      "Local session signer's raw 65-byte ECDSA signature of the prepared typed data, without the ERC-1271 validation envelope.",
  }),
}).annotate({ identifier: "CompleteSignatureRequest" });

export const CompleteSignatureResponse = SignResponse.annotate({
  identifier: "CompleteSignatureResponse",
});

export type PrepareSignatureRequest = typeof PrepareSignatureRequest.Type;
export type PrepareSignatureResponse = typeof PrepareSignatureResponse.Type;
export type CompleteSignatureRequest = typeof CompleteSignatureRequest.Type;
export type CompleteSignatureResponse = typeof CompleteSignatureResponse.Type;

export const PrepareManagedSignatureRequest = PrepareSignatureRequest.annotate({
  identifier: "PrepareManagedSignatureRequest",
  description:
    "Reserve permitted message or typed-data signing by an installed 1Claw-managed session.",
});
export const PrepareManagedSignatureResponse = Schema.Struct(
  Struct.omit(PrepareSignatureResponse.fields, ["signing"]),
).annotate({ identifier: "PrepareManagedSignatureResponse" });
export const CompleteManagedSignatureRequest = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  operationId: SignatureOperationId,
}).annotate({
  identifier: "CompleteManagedSignatureRequest",
  description:
    "Sign only the stored payload. Results are not persisted. After a lost successful response, prepare a fresh authorized billable attempt.",
});
export type PrepareManagedSignatureResponse = typeof PrepareManagedSignatureResponse.Type;
export type PrepareManagedSignatureRequest = typeof PrepareManagedSignatureRequest.Type;
export type CompleteManagedSignatureRequest = typeof CompleteManagedSignatureRequest.Type;
