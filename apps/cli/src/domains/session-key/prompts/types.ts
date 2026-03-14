import type { Abi, Address, Hex } from "viem";

export type PolicyData<TPolicy extends string, TData> = {
  type: TPolicy;
  data: TData;
};

export type SudoPolicyData = PolicyData<"sudo", null>;
export type TimestampPolicyData = PolicyData<
  "timestamp",
  {
    validAfter: Date;
    validUntil: Date;
  }
>;

export type GasPolicyData = PolicyData<"gas", { allowed: string }>;

export type CallPolicyData = PolicyData<
  "call",
  | {
      target: Address;
      valueLimit: string;
    }
  | {
      target: Address;
      valueLimit: string;
      abi: Abi;
      functionName: string;
      selector?: Hex;
    }
>;

export type PolicyDataType =
  | SudoPolicyData
  | TimestampPolicyData
  | GasPolicyData
  | CallPolicyData;
