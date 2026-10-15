import { type Effect, Schema } from "effect";

import type { PolicyId } from "#/common/index";

export const PolicyApplicability = Schema.Literal("signature");

export type PolicyApplicability = typeof PolicyApplicability.Type;

// Signature policies are stateless; transaction limits are enforced onchain.
export abstract class PolicyHandler<
  Policy extends { readonly id: PolicyId; readonly type: string; readonly version: number },
  Context,
  Decision,
  Error = never,
  Requirements = never,
> {
  abstract readonly type: Policy["type"];
  abstract readonly policySchema: Schema.Schema<Policy>;
  abstract readonly evaluate: (
    policy: Policy,
    context: Context,
  ) => Effect.Effect<Decision, Error, Requirements>;
}
