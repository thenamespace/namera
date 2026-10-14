import type { CreateEvmSessionKeyPolicy, EvmSessionKeyPolicy } from "@namera-ai/protocol/model";

import { type EvmPolicyDefinition, signatureStateless } from "./operations.js";
import { EvmChainAllowlistSignaturePolicyHandler } from "./policies/chain-allowlist.js";
import { EvmSignaturePolicyHandler } from "./policies/signature.js";
import { EvmTimeWindowSignaturePolicyHandler } from "./policies/time-window.js";

type EvmPolicyType = EvmSessionKeyPolicy["type"];
export type EvmPolicyCardinality = "singleton";
type EvmPolicyRegistry = { readonly [Type in EvmPolicyType]: EvmPolicyDefinition<Type> };

export const evmPolicyRegistry = {
  "evm.time-window": {
    type: "evm.time-window",
    applicability: "signature",
    cardinality: "singleton",
    priority: 100,
    signature: signatureStateless(new EvmTimeWindowSignaturePolicyHandler(), {
      grantsAccess: false,
    }),
  },
  "evm.chain-allowlist": {
    type: "evm.chain-allowlist",
    applicability: "signature",
    cardinality: "singleton",
    priority: 200,
    signature: signatureStateless(new EvmChainAllowlistSignaturePolicyHandler(), {
      grantsAccess: false,
    }),
  },
  "evm.signature": {
    type: "evm.signature",
    applicability: "signature",
    cardinality: "singleton",
    priority: 600,
    signature: signatureStateless(new EvmSignaturePolicyHandler(), { grantsAccess: true }),
  },
} satisfies EvmPolicyRegistry;

export const getEvmPolicyDefinition = (type: EvmPolicyType): EvmPolicyDefinition<EvmPolicyType> =>
  evmPolicyRegistry[type];

export const materializeEvmPolicy = (
  policy: CreateEvmSessionKeyPolicy,
  id: EvmSessionKeyPolicy["id"],
): EvmSessionKeyPolicy => ({ ...policy, id, appliesTo: "signature" });

export const findEvmPolicyCardinalityViolation = (
  policies: ReadonlyArray<CreateEvmSessionKeyPolicy>,
): EvmPolicyType | undefined => {
  const seen = new Set<EvmPolicyType>();
  for (const policy of policies) {
    if (seen.has(policy.type)) return policy.type;
    seen.add(policy.type);
  }
  return undefined;
};

export const getEvmPolicyDefinitionFor = (policy: EvmSessionKeyPolicy) => {
  const definition = getEvmPolicyDefinition(policy.type);
  if (definition.applicability !== policy.appliesTo)
    throw new Error(
      `Policy registry applicability mismatch: expected ${definition.applicability}, received ${policy.appliesTo}`,
    );
  return definition;
};

export const orderEvmPolicies = (policies: ReadonlyArray<EvmSessionKeyPolicy>) =>
  policies.toSorted((left, right) => {
    const priority =
      getEvmPolicyDefinitionFor(left).priority - getEvmPolicyDefinitionFor(right).priority;
    return priority === 0 ? left.id.localeCompare(right.id) : priority;
  });

export type { EvmPolicyDefinition, EvmSignaturePolicyOperation } from "./operations.js";
