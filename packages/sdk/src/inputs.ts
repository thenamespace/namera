import type { Brand } from "effect";

import type * as Protocol from "@namera-ai/protocol/dto";
import type { EvmTypedData as ProtocolTypedData } from "@namera-ai/protocol/evm";

// Keep protocol literals, optional fields, tuples, and bigint values; only remove brands.
type Input<T> =
  T extends Brand.Brand<infer _Name>
    ? Brand.Brand.Unbranded<T>
    : T extends object
      ? { [K in keyof T]: Input<T[K]> }
      : T;

export type ExecuteRequest = Input<Protocol.ExecuteRequest>;
export type PrepareExecutionRequest = Input<Protocol.PrepareExecutionRequest>;
export type CompleteExecutionRequest = Input<Protocol.CompleteExecutionRequest>;
export type SimulateExecutionRequest = Input<Protocol.SimulateExecutionRequest>;
export type PrepareSignatureRequest = Input<Protocol.PrepareSignatureRequest>;
export type SignRequest = PrepareSignatureRequest;
export type CompleteSignatureRequest = Input<Protocol.CompleteSignatureRequest>;
export type VerifySignatureRequest = Input<Protocol.VerifySignatureRequest>;
export type EvmTypedData = Input<ProtocolTypedData>;
export type ListExecutionsOptions = Input<Protocol.ListExecutionsRequest>;
export type ListSessionKeysOptions = Partial<Input<Protocol.ListSessionKeysForWalletRequest>>;

export type { Hex, SupportedEvmChainId } from "@namera-ai/protocol/evm";
export type EthereumAddress = ExecuteRequest["calls"][number]["to"];
export type Namespace = ExecuteRequest["namespace"];

export type CreateWalletRequest = Omit<Input<Protocol.CreateWalletRequest>, "idempotencyKey">;
export type CreateSessionKeyRequest = Omit<
  Input<Protocol.CreateSessionKeyRequest>,
  "idempotencyKey"
>;
export type CreatePasskeyRegistrationOptionsRequest = Required<
  Input<Protocol.CreatePasskeyRegistrationOptionsRequest>
>;
export type SessionKeyOperationTarget = {
  readonly sessionKeyId: string;
  readonly chainId: Protocol.PrepareExecutionRequest["chainId"];
  readonly kind: "install" | "uninstall";
};
export type PrepareSessionKeyOperationRequest = SessionKeyOperationTarget & {
  readonly sponsor?: boolean;
};
export type ApproveSessionKeyOperationRequest = {
  readonly operationId: string;
  readonly approval:
    | { readonly type: "1claw" }
    | {
        readonly type: "passkey";
        readonly response: Input<Protocol.CompleteSessionKeyOperationRequest["response"]>;
      };
};
