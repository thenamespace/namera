/** biome-ignore-all lint/style/useCollapsedIf: safe */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: safe */
import type {
  CallPolicyParams,
  GasPolicyParams,
  Policy,
  RateLimitPolicyParams,
  SignatureCallerPolicyParams,
  SudoPolicyParams,
  TimestampPolicyParams,
} from "@namera-ai/core/policy";
import { Effect } from "effect";
import type { Address, Hex } from "viem";

import { CurrentMcpContext, type LocalSessionKeyData } from "@/layers";

export type Intent = "sign" | "transaction" | "read";

export type Operation<TIntent extends Intent, TData> = TData & {
  intent: TIntent;
};

// biome-ignore lint/complexity/noBannedTypes: safe
type ReadOperation = Operation<"read", {}>;

export type Call = {
  target: Address;
  value: bigint;
  data: Hex;
};
type WriteOperation = Operation<
  "transaction",
  {
    calls: Call[];
  }
>;
type SignOperation = Operation<
  "sign",
  {
    allowedCallers?: Address[];
  }
>;

type AnyOperation = ReadOperation | WriteOperation | SignOperation;

type PolicyMap = Partial<{
  timestamp: TimestampPolicyParams & { type: "timestamp" };
  call: CallPolicyParams & { type: "call" };
  signatureCaller: SignatureCallerPolicyParams & {
    type: "signature-caller";
  };
  gas: GasPolicyParams & { type: "gas" };
  rateLimit: RateLimitPolicyParams & { type: "rate-limit" };
  sudo: SudoPolicyParams & { type: "sudo" };
}>;

type PolicyParams = Policy["policyParams"];

function toPolicyMap(policies: PolicyParams[]): PolicyMap | null {
  const map: PolicyMap = {};

  for (const p of policies) {
    if (p.type === "timestamp") {
      if (map.timestamp) return null; // Gracefully invalidate this key
      map.timestamp = p;
    }
    if (p.type === "call") {
      if (map.call) return null;
      map.call = p;
    }
    if (p.type === "signature-caller") {
      if (map.signatureCaller) return null;
      map.signatureCaller = p;
    }
    if (p.type === "gas") {
      if (map.gas) return null;
      map.gas = p;
    }
    if (p.type === "rate-limit") {
      if (map.rateLimit) return null;
      map.rateLimit = p;
    }
    if (p.type === "sudo") {
      if (map.sudo) return null;
      map.sudo = p;
    }
  }

  return map;
}

export function evaluateTimestamp(
  policy: TimestampPolicyParams,
  _operation: AnyOperation,
): boolean {
  // validAfter: the time after which the signer becomes valid.
  // If not specified, the signer is immediately valid.
  //
  // validUntil: the time before which the signer is valid.
  // If not specified, the signer never expires.
  const now = Date.now(); // ms

  if (policy.validAfter !== undefined && now < policy.validAfter * 1000) {
    return false;
  }

  if (policy.validUntil !== undefined && now >= policy.validUntil * 1000) {
    return false;
  }

  return true;
}

export function evaluateSignature(
  policy: SignatureCallerPolicyParams,
  operation: Extract<AnyOperation, { intent: "sign" }>,
): boolean {
  const callers = operation.allowedCallers;

  if (!callers || callers.length === 0) return false;

  // every caller must be allowed
  return callers.every((caller) => policy.allowedCallers.includes(caller));
}

export function evaluateCall(
  policy: CallPolicyParams,
  operation: Extract<AnyOperation, { intent: "transaction" }>,
): boolean {
  const permissions = policy.permissions ?? [];
  if (permissions.length === 0) return false;

  const { calls } = operation;
  if (!calls || calls.length === 0) return false;

  return calls.every((call) => {
    const { target, value, data } = call;

    return permissions.some((p) => {
      if (p.target !== target) return false;
      const valueLimit = p.valueLimit ?? 0n;
      if (value > valueLimit) return false;

      const isContractCall = data.length >= 10;

      if ("functionName" in p) {
        if (!isContractCall) return false;
        if (!p.selector) return false;

        const selector = data.slice(0, 10);
        if (selector !== p.selector) return false;

        // TODO: param rules
        return true;
      }

      // EOA
      return true;
    });
  });
}

type PickSessionKeyParams = {
  operation: AnyOperation;
};

const evaluateSessionKey = (
  sessionKey: LocalSessionKeyData,
  operation: AnyOperation,
) => {
  if (operation.intent === "read") return true;

  const policies = (
    sessionKey.data.accountParams.permissionParams.policies ?? []
  ).map((x) => x.policyParams);

  const p = toPolicyMap(policies);

  if (!p) return false;

  const hasSudo = Boolean(p.sudo);

  // A valid sudo key should not have call or signature policies attached
  if (hasSudo && (p.call || p.signatureCaller)) {
    return false;
  }

  if (p.timestamp) {
    if (!evaluateTimestamp(p.timestamp, operation)) return false;
  }

  // TODO: Do gas and rate limits

  if (!hasSudo) {
    if (operation.intent === "transaction") {
      if (!p.call) return false;
      if (!evaluateCall(p.call, operation)) return false;
    }

    if (operation.intent === "sign") {
      if (!p.signatureCaller) return false;
      if (!evaluateSignature(p.signatureCaller, operation)) return false;
    }
  }

  return true;
};

export const getValidSessionKeys = (params: PickSessionKeyParams) =>
  Effect.gen(function* () {
    const context = yield* CurrentMcpContext;
    const { sessionKeys } = context;

    const validKeys = sessionKeys.filter((sk) => {
      return evaluateSessionKey(sk, params.operation);
    });

    return validKeys;
  });
