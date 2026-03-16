// TODO: Make a engine that picks the right session key based on its policies and what the user wants to do

import { Effect } from "effect";
import { type Address, type Hex, hexToBytes } from "viem";

import { CurrentMcpContext } from "@/layers";

export type Intent = "sign" | "transaction" | "read";

export type Operation<TIntent extends Intent, TData> = {
  intent: TIntent;
  data: TData;
};

type ReadOperation = Operation<"read", never>;
type WriteOperation = Operation<
  "transaction",
  {
    target: Address;
    value: bigint;
    data: Hex;
  }
>;
type SignOperation = Operation<
  "sign",
  {
    validator?: Address;
  }
>;

type AnyOperation = ReadOperation | WriteOperation | SignOperation;

type PickSessionKeyParams = {
  operation: AnyOperation;
};

export const pickSessionKey = (params: PickSessionKeyParams) =>
  Effect.gen(function* () {
    const context = yield* CurrentMcpContext;
    const { sessionKeys } = context;

    // 1. Check if there is a sudo key
    const sudoKey = sessionKeys.find((sk) => {
      const policies = sk.serializedPlugin.policies;
      return policies.some((p) => p.type === "sudo");
    });

    if (sudoKey) return sudoKey;

    if (params.operation.intent === "read") {
      // TODO: Check if this is correct, read ops should be allowed for all keys, so just pick the first one
      return sessionKeys[0];
    }

    if (params.operation.intent === "sign") {
      // TODO: Implement this when we have signature policy.
      // The signature caller policy specifies a list of addresses that are allowed to validate messages signed by the signer.
      // If there is a validator address specified in the operation, check for session key which has a signature policy with that address.
      return sessionKeys[0];
    }

    if (params.operation.intent === "transaction") {
      const data = params.operation.data;
      // For Transaction we have two cases:

      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: safe
      const key = sessionKeys.filter((sk) => {
        const policies = sk.serializedPlugin.policies;

        const timestampPolicies = policies.filter(
          (p) => p.type === "timestamp",
        );

        for (const tPolicy of timestampPolicies) {
          const now = new Date();
          if (tPolicy.data.validAfter < now) return false;
          if (tPolicy.data.validUntil > now) return false;
        }

        // 1. Filter out keys which have a call policy
        const callPolicies = policies.filter((p) => p.type === "call");
        if (callPolicies.length === 0) return false;

        // 2. Filter out policies where target address matches and value limit is greater than or equal to the amount
        const filteredPolicies = callPolicies.filter((p) => {
          const target = p.data.target;
          const limit = p.data.valueLimit;
          return target === data.target && BigInt(limit) >= data.value;
        });

        if (filteredPolicies.length === 0) return false;

        // Check if call type is to a contract
        const isContractCall = hexToBytes(data.data).length > 0;

        // If not contract call, filter out those who don't have a selector
        if (!isContractCall) {
          const f = filteredPolicies.filter((p) => {
            const d = p.data;
            const hasSelector = "selector" in d;
            return !hasSelector;
          });

          if (f.length === 0) return false;
        } else {
          const selector = data.data.slice(0, 10) as Hex;
          const f = filteredPolicies.filter((p) => {
            const d = p.data;
            const hasSelector = "selector" in d;
            return hasSelector && d.selector === selector;
          });
          if (f.length === 0) return false;
        }

        return true;
      });
      return key[0];
    }

    // TODO: Check more...
    return;
  });
