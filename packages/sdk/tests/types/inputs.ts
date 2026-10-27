import type {
  CompleteExecutionRequest,
  CompleteSignatureRequest,
  EthereumAddress,
  ExecuteRequest,
  Namespace,
  SupportedEvmChainId,
} from "@namera-ai/sdk";
import { expectTypeOf } from "vitest";

expectTypeOf<Namespace>().toEqualTypeOf<"eip155">();
expectTypeOf<SupportedEvmChainId>().toEqualTypeOf<
  | "eip155:1"
  | "eip155:10"
  | "eip155:5042"
  | "eip155:5042002"
  | "eip155:8453"
  | "eip155:42161"
  | "eip155:84532"
  | "eip155:421614"
  | "eip155:11155111"
  | "eip155:11155420"
>();
expectTypeOf<ExecuteRequest["chainId"]>().toEqualTypeOf<SupportedEvmChainId>();
expectTypeOf<ExecuteRequest["walletId"]>().toEqualTypeOf<string>();
expectTypeOf<EthereumAddress>().toEqualTypeOf<`0x${string}`>();
expectTypeOf<ExecuteRequest["calls"][number]["value"]>().toEqualTypeOf<bigint>();
expectTypeOf<CompleteExecutionRequest["submissionId"]>().toEqualTypeOf<string>();
expectTypeOf<CompleteSignatureRequest["operationId"]>().toEqualTypeOf<string>();

import type {
  CreateWalletRequest,
  CreateSessionKeyRequest,
  PrepareSessionKeyOperationRequest,
} from "@namera-ai/sdk";
expectTypeOf<CreateWalletRequest>().not.toHaveProperty("idempotencyKey");
expectTypeOf<CreateSessionKeyRequest>().not.toHaveProperty("idempotencyKey");
expectTypeOf<PrepareSessionKeyOperationRequest>().not.toHaveProperty("idempotencyKey");
expectTypeOf<CreateSessionKeyRequest["walletId"]>().toEqualTypeOf<string>();
