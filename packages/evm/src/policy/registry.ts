import type { CreateEvmSessionKeyPolicy, EvmSessionKeyPolicy } from "@namera-ai/protocol/model";

import {
  executionStateful,
  executionStateless,
  type EvmPolicyDefinition,
  notApplicable,
  signatureStateless,
} from "./operations.js";
import { callAccessHandler } from "./policies/call-access.js";
import {
  EvmChainAllowlistPolicyHandler,
  EvmChainAllowlistSignaturePolicyHandler,
} from "./policies/chain-allowlist.js";
import { EvmGasBudgetPolicyHandler } from "./policies/gas-budget.js";
import { EvmNativeSpendLimitPolicyHandler } from "./policies/native-spend-limit.js";
import { EvmSignaturePolicyHandler } from "./policies/signature.js";
import {
  EvmTimeWindowPolicyHandler,
  EvmTimeWindowSignaturePolicyHandler,
} from "./policies/time-window.js";
import { tokenSpendHandler } from "./policies/token-spend-limit.js";

type EvmPolicyType = EvmSessionKeyPolicy["type"];
export type EvmPolicyCardinality = "singleton" | "repeatable";

type EvmPolicyRegistry = {
  readonly [Type in EvmPolicyType]: EvmPolicyDefinition<Type>;
};

const chainAllowlistHandler = new EvmChainAllowlistPolicyHandler();
const chainAllowlistSignatureHandler = new EvmChainAllowlistSignaturePolicyHandler();
const gasBudgetHandler = new EvmGasBudgetPolicyHandler();
const nativeSpendLimitHandler = new EvmNativeSpendLimitPolicyHandler();
const timeWindowHandler = new EvmTimeWindowPolicyHandler();
const timeWindowSignatureHandler = new EvmTimeWindowSignaturePolicyHandler();
const signatureHandler = new EvmSignaturePolicyHandler();

export const evmPolicyRegistry = {
  "evm.contract-access": {
    type: "evm.contract-access",
    applicability: "execution",
    cardinality: "singleton",
    priority: 300,
    execution: executionStateless(callAccessHandler("evm.contract-access")),
    signature: notApplicable,
  },
  "evm.functions-on-contract": {
    type: "evm.functions-on-contract",
    applicability: "execution",
    cardinality: "singleton",
    priority: 310,
    execution: executionStateless(callAccessHandler("evm.functions-on-contract")),
    signature: notApplicable,
  },
  "evm.functions-on-all-contracts": {
    type: "evm.functions-on-all-contracts",
    applicability: "execution",
    cardinality: "singleton",
    priority: 320,
    execution: executionStateless(callAccessHandler("evm.functions-on-all-contracts")),
    signature: notApplicable,
  },
  "evm.account-functions": {
    type: "evm.account-functions",
    applicability: "execution",
    cardinality: "singleton",
    priority: 330,
    execution: executionStateless(callAccessHandler("evm.account-functions")),
    signature: notApplicable,
  },
  "evm.erc20-token-transfer": {
    type: "evm.erc20-token-transfer",
    applicability: "execution",
    cardinality: "singleton",
    priority: 510,
    execution: executionStateful(tokenSpendHandler),
    signature: notApplicable,
  },
  "evm.chain-allowlist": {
    type: "evm.chain-allowlist",
    applicability: "both",
    cardinality: "singleton",
    priority: 200,
    execution: executionStateless(chainAllowlistHandler),
    signature: signatureStateless(chainAllowlistSignatureHandler, { grantsAccess: false }),
  },
  "evm.gas-budget": {
    type: "evm.gas-budget",
    applicability: "execution",
    cardinality: "singleton",
    priority: 400,
    execution: executionStateful(gasBudgetHandler),
    signature: notApplicable,
  },
  "evm.native-spend-limit": {
    type: "evm.native-spend-limit",
    applicability: "execution",
    cardinality: "singleton",
    priority: 500,
    execution: executionStateful(nativeSpendLimitHandler),
    signature: notApplicable,
  },
  "evm.time-window": {
    type: "evm.time-window",
    applicability: "both",
    cardinality: "singleton",
    priority: 100,
    execution: executionStateless(timeWindowHandler),
    signature: signatureStateless(timeWindowSignatureHandler, { grantsAccess: false }),
  },
  "evm.signature": {
    type: "evm.signature",
    applicability: "signature",
    cardinality: "singleton",
    priority: 600,
    execution: notApplicable,
    signature: signatureStateless(signatureHandler, { grantsAccess: true }),
  },
} satisfies EvmPolicyRegistry;

export const getEvmPolicyDefinition = (type: EvmPolicyType): EvmPolicyDefinition<EvmPolicyType> =>
  evmPolicyRegistry[type];

export const materializeEvmPolicy = (
  policy: CreateEvmSessionKeyPolicy,
  id: EvmSessionKeyPolicy["id"],
): EvmSessionKeyPolicy => {
  const definition = getEvmPolicyDefinition(policy.type);

  // Registry ownership keeps code-owned applicability out of application workflows.
  return { ...policy, id, appliesTo: definition.applicability } as EvmSessionKeyPolicy;
};

export const findEvmPolicyCardinalityViolation = (
  policies: ReadonlyArray<CreateEvmSessionKeyPolicy>,
): EvmPolicyType | undefined => {
  const seen = new Set<EvmPolicyType>();
  for (const policy of policies) {
    const definition = getEvmPolicyDefinition(policy.type);
    if (definition.cardinality === "repeatable") continue;
    if (seen.has(policy.type)) return policy.type;
    seen.add(policy.type);
  }
  return undefined;
};

export const getEvmPolicyDefinitionFor = (policy: EvmSessionKeyPolicy) => {
  const definition = getEvmPolicyDefinition(policy.type);
  if (definition.applicability !== policy.appliesTo) {
    throw new Error(
      `Policy registry applicability mismatch: expected ${definition.applicability}, received ${policy.appliesTo}`,
    );
  }
  return definition;
};

export const orderEvmPolicies = (policies: ReadonlyArray<EvmSessionKeyPolicy>) =>
  policies.toSorted((left, right) => {
    const priorityDifference =
      getEvmPolicyDefinitionFor(left).priority - getEvmPolicyDefinitionFor(right).priority;
    return priorityDifference === 0 ? left.id.localeCompare(right.id) : priorityDifference;
  });

export type {
  EvmExecutionPolicyOperation,
  EvmPolicyDefinition,
  EvmSignaturePolicyOperation,
} from "./operations.js";
