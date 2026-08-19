import { Schema } from "effect";

import { WalletId } from "#/common/index";
import {
  EthereumAddress,
  EVM_MAX_SIGNATURE_PAYLOAD_BYTES,
  EvmTypedData,
  Hex,
  SupportedEvmChainId,
} from "#/evm/index";
import { NonEmptyString } from "#/model/common";

const SignEvmRequestCommon = {
  namespace: Schema.Literal("eip155"),
  walletId: WalletId,
  chainId: SupportedEvmChainId,
};

const textEncoder = new TextEncoder();
const boundedSignaturePayload = (payload: string) =>
  textEncoder.encode(payload).byteLength <= EVM_MAX_SIGNATURE_PAYLOAD_BYTES
    ? undefined
    : { path: [], issue: "Signature payloads may not exceed 64 KiB" };

export const SignEvmMessageRequest = Schema.Struct({
  ...SignEvmRequestCommon,
  type: Schema.Literal("message"),
  message: Schema.String.check(Schema.makeFilter(boundedSignaturePayload)),
}).annotate({
  identifier: "SignEvmMessageRequest",
  description: "Sign a UTF-8 message with an authorized EVM smart account",
});

export const SignEvmTypedDataRequest = Schema.Struct({
  ...SignEvmRequestCommon,
  type: Schema.Literal("typed-data"),
  typedData: EvmTypedData,
})
  .check(Schema.makeFilter((request) => boundedSignaturePayload(JSON.stringify(request.typedData))))
  .annotate({
    identifier: "SignEvmTypedDataRequest",
    description: "Sign EIP-712 typed data with an authorized EVM smart account",
  });

export const SignRequest = Schema.Union([SignEvmMessageRequest, SignEvmTypedDataRequest], {
  mode: "oneOf",
}).annotate({ identifier: "SignRequest" });

export const SignRequestHeaders = Schema.Struct({
  "idempotency-key": NonEmptyString,
}).annotate({ identifier: "SignRequestHeaders" });

const SignEvmResponseCommon = {
  namespace: Schema.Literal("eip155"),
  walletId: WalletId,
  chainId: SupportedEvmChainId,
  account: EthereumAddress,
  signature: Hex,
};

export const SignEvmMessageResponse = Schema.Struct({
  ...SignEvmResponseCommon,
  type: Schema.Literal("message"),
}).annotate({ identifier: "SignEvmMessageResponse" });

export const SignEvmTypedDataResponse = Schema.Struct({
  ...SignEvmResponseCommon,
  type: Schema.Literal("typed-data"),
}).annotate({ identifier: "SignEvmTypedDataResponse" });

export const SignResponse = Schema.Union([SignEvmMessageResponse, SignEvmTypedDataResponse], {
  mode: "oneOf",
}).annotate({ identifier: "SignResponse" });

export type SignEvmMessageRequest = typeof SignEvmMessageRequest.Type;
export type SignEvmTypedDataRequest = typeof SignEvmTypedDataRequest.Type;
export type SignRequest = typeof SignRequest.Type;
export type SignRequestHeaders = typeof SignRequestHeaders.Type;
export type SignEvmMessageResponse = typeof SignEvmMessageResponse.Type;
export type SignEvmTypedDataResponse = typeof SignEvmTypedDataResponse.Type;
export type SignResponse = typeof SignResponse.Type;
