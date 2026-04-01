import type {
  CallPolicyParams,
  GasPolicyParams,
  RateLimitPolicyParams,
  SignatureCallerPolicyParams,
  SudoPolicyParams,
  TimestampPolicyParams,
} from "@namera-ai/sdk/policy";
import type { Address } from "viem";

import type { Batch } from "@/schema/tx";

export type Intent = "sign" | "transaction" | "read";

export type Operation<TIntent extends Intent, TData> = TData & {
  intent: TIntent;
};

export type ReadOperation = Operation<
  "read",
  {
    chainId: number;
  }
>;
export type SignOperation = Operation<
  "sign",
  {
    chainId: number;
    allowedCallers?: Address[];
  }
>;
export type WriteOperation = Operation<
  "transaction",
  {
    batches: Batch[];
  }
>;

export type AnyOperation = ReadOperation | WriteOperation | SignOperation;

export type PolicyMap = Partial<{
  timestamp: TimestampPolicyParams & { type: "timestamp" };
  call: CallPolicyParams & { type: "call" };
  signatureCaller: SignatureCallerPolicyParams & {
    type: "signature-caller";
  };
  gas: GasPolicyParams & { type: "gas" };
  rateLimit: RateLimitPolicyParams & { type: "rate-limit" };
  sudo: SudoPolicyParams & { type: "sudo" };
}>;
