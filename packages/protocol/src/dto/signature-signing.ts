import { Schema } from "effect";

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
    "Prepare a message or typed-data signature for the selected installed session. The server resolves custody. Never send private key material.",
});

export const PrepareSignatureResponse = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  operationId: SignatureOperationId,
  installationId: SessionKeyInstallationId,
  signingKeyId: SigningKeyId,
  request: PrepareSignatureRequest,
  signing: Schema.Union([
    Schema.Struct({
      method: Schema.Literal("eth_signTypedData_v4"),
      typedData: EvmTypedData,
    }),
    Schema.Struct({ method: Schema.Literal("server") }),
  ]),
  expiresAt: Schema.DateTimeUtcFromDate,
}).annotate({
  identifier: "PrepareSignatureResponse",
  description:
    "Reserved signature operation and replay-safe EIP-712 challenge. The client must recompute the challenge from its wallet/session binding and original payload before signing locally.",
});

export const CompleteSignatureRequest = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  operationId: SignatureOperationId,
  signature: Schema.optionalKey(
    Hex.check(Schema.isPattern(/^0x[0-9a-fA-F]{130}$/)).annotate({
      description:
        "Local session signer's raw 65-byte ECDSA signature of the prepared typed data, without the ERC-1271 validation envelope.",
    }),
  ),
}).annotate({ identifier: "CompleteSignatureRequest" });

export const CompleteSignatureResponse = SignResponse.annotate({
  identifier: "CompleteSignatureResponse",
});

export type PrepareSignatureRequest = typeof PrepareSignatureRequest.Type;
export type PrepareSignatureResponse = typeof PrepareSignatureResponse.Type;
export type CompleteSignatureRequest = typeof CompleteSignatureRequest.Type;
export type CompleteSignatureResponse = typeof CompleteSignatureResponse.Type;
