import { Schema } from "effect";

import { SignatureOperationId, SigningKeyId, WalletId } from "#/common/index";
import { EthereumAddress } from "#/evm/index";

import {
  SignEvmMessageRequest,
  SignEvmTypedDataRequest,
  SignEvmMessageResponse,
  SignEvmTypedDataResponse,
  SignRequestHeaders,
} from "./signature.js";
import { PasskeyAuthenticationOptions, PasskeyAuthenticationResponse } from "./wallet/passkey.js";

export const WalletSignatureParams = Schema.Struct({ walletId: WalletId });
export const PrepareWalletSignatureHeaders = SignRequestHeaders;
export const PrepareWalletEvmMessageRequest = Schema.Struct({
  namespace: SignEvmMessageRequest.fields.namespace,
  chainId: SignEvmMessageRequest.fields.chainId,
  type: SignEvmMessageRequest.fields.type,
  message: SignEvmMessageRequest.fields.message,
}).annotate({ identifier: "PrepareWalletEvmMessageRequest" });
export const PrepareWalletEvmTypedDataRequest = Schema.Struct({
  namespace: SignEvmTypedDataRequest.fields.namespace,
  chainId: SignEvmTypedDataRequest.fields.chainId,
  type: SignEvmTypedDataRequest.fields.type,
  typedData: SignEvmTypedDataRequest.fields.typedData,
}).annotate({ identifier: "PrepareWalletEvmTypedDataRequest" });
export const PrepareWalletEvmSignatureRequest = Schema.Union(
  [PrepareWalletEvmMessageRequest, PrepareWalletEvmTypedDataRequest],
  { mode: "oneOf" },
).annotate({ identifier: "PrepareWalletEvmSignatureRequest" });
export const PrepareWalletSignatureRequest = Schema.Union([PrepareWalletEvmSignatureRequest], {
  mode: "oneOf",
}).annotate({ identifier: "PrepareWalletSignatureRequest" });
export const PrepareWalletEvmSignatureResponse = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  operationId: SignatureOperationId,
  walletId: WalletId,
  signingKeyId: SigningKeyId,
  account: EthereumAddress,
  request: PrepareWalletEvmSignatureRequest,
  signing: Schema.Union(
    [
      Schema.Struct({ method: Schema.Literal("passkey"), options: PasskeyAuthenticationOptions }),
      Schema.Struct({ method: Schema.Literal("server") }),
    ],
    { mode: "oneOf" },
  ),
  expiresAt: Schema.DateTimeUtcFromDate,
}).annotate({ identifier: "PrepareWalletEvmSignatureResponse" });
export const PrepareWalletSignatureResponse = Schema.Union([PrepareWalletEvmSignatureResponse], {
  mode: "oneOf",
}).annotate({ identifier: "PrepareWalletSignatureResponse" });
export const CompleteWalletEvmSignatureRequest = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  operationId: SignatureOperationId,
  response: Schema.optionalKey(PasskeyAuthenticationResponse),
}).annotate({ identifier: "CompleteWalletEvmSignatureRequest" });
export const CompleteWalletSignatureRequest = Schema.Union([CompleteWalletEvmSignatureRequest], {
  mode: "oneOf",
}).annotate({ identifier: "CompleteWalletSignatureRequest" });
export const CompleteWalletEvmMessageResponse = Schema.Struct({
  ...SignEvmMessageResponse.fields,
  operationId: SignatureOperationId,
}).annotate({ identifier: "CompleteWalletEvmMessageResponse" });
export const CompleteWalletEvmTypedDataResponse = Schema.Struct({
  ...SignEvmTypedDataResponse.fields,
  operationId: SignatureOperationId,
}).annotate({ identifier: "CompleteWalletEvmTypedDataResponse" });
export const CompleteWalletEvmSignatureResponse = Schema.Union(
  [CompleteWalletEvmMessageResponse, CompleteWalletEvmTypedDataResponse],
  { mode: "oneOf" },
).annotate({ identifier: "CompleteWalletEvmSignatureResponse" });
export const CompleteWalletSignatureResponse = Schema.Union([CompleteWalletEvmSignatureResponse], {
  mode: "oneOf",
}).annotate({ identifier: "CompleteWalletSignatureResponse" });
export type PrepareWalletSignatureRequest = typeof PrepareWalletSignatureRequest.Type;
export type PrepareWalletSignatureResponse = typeof PrepareWalletSignatureResponse.Type;
export type CompleteWalletSignatureRequest = typeof CompleteWalletSignatureRequest.Type;
export type CompleteWalletSignatureResponse = typeof CompleteWalletSignatureResponse.Type;
