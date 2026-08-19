import { type Effect, Schema } from "effect";

import type { PolicyId } from "#/common/index";

export const PolicyApplicability = Schema.Literals(["execution", "signature", "both"]);

export type PolicyApplicability = typeof PolicyApplicability.Type;

// Policy handlers define a namespace adapter's complete policy lifecycle:
// evaluate performs a read-only eligibility check; reserve atomically claims
// state before submission; settle commits confirmed usage; release returns a
// failed or abandoned submission's reservation. Stateless policies implement
// only evaluate. Schemas keep JSONB data versioned and checked at the boundary.
export abstract class PolicyHandler<
  Policy extends { readonly id: PolicyId; readonly type: string; readonly version: number },
  Context,
  Decision,
  State = never,
  Reservation = never,
  Result = never,
  Error = never,
  Requirements = never,
> {
  abstract readonly type: Policy["type"];
  abstract readonly policySchema: Schema.Schema<Policy>;
  readonly stateSchema?: Schema.Schema<State>;
  readonly reservationSchema?: Schema.Schema<Reservation>;

  readonly initialStates?: (
    policy: Policy,
    context: Context,
  ) => Effect.Effect<ReadonlyMap<string, State>, Error, Requirements>;

  abstract readonly evaluate: (
    policy: Policy,
    context: Context,
  ) => Effect.Effect<Decision, Error, Requirements>;

  readonly reserve?: (
    policy: Policy,
    context: Context,
    states: ReadonlyMap<string, State>,
  ) => Effect.Effect<
    {
      readonly decision: Decision;
      readonly states: ReadonlyMap<string, State>;
      readonly reservations: ReadonlyMap<string, Reservation>;
    },
    Error,
    Requirements
  >;

  readonly settle?: (
    policy: Policy,
    states: ReadonlyMap<string, State>,
    reservations: ReadonlyMap<string, Reservation>,
    result: Result,
  ) => Effect.Effect<ReadonlyMap<string, State>, Error, Requirements>;

  readonly release?: (
    policy: Policy,
    states: ReadonlyMap<string, State>,
    reservations: ReadonlyMap<string, Reservation>,
  ) => Effect.Effect<ReadonlyMap<string, State>, Error, Requirements>;
}
