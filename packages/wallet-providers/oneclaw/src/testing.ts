import { Context, Effect, Layer, Option, Ref } from "effect";

import type { OneClawError, OneClawOperation } from "@namera-ai/protocol";

import { oneClawError } from "#/errors";
import { OneClawService, type OneClawOperations } from "#/service";

export class OneClawTestControl extends Context.Service<
  OneClawTestControl,
  {
    readonly calls: Ref.Ref<ReadonlyArray<OneClawOperation>>;
  }
>()("@namera-ai/wallet-provider-oneclaw/OneClawTestControl") {}

// Missing scenario operations fail closed, rather than inventing successful custody.
export interface OneClawTestScenario {
  readonly connections?: Partial<OneClawOperations["connections"]>;
  readonly customers?: Partial<OneClawOperations["customers"]>;
  readonly agents?: Partial<OneClawOperations["agents"]>;
  readonly signingKeys?: Partial<OneClawOperations["signingKeys"]>;
  readonly signing?: Partial<OneClawOperations["signing"]>;
}

export const oneClawTestLayer = (scenario: OneClawTestScenario = {}) =>
  Layer.effectContext(
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<OneClawOperation>>([]);
      const observe =
        <A extends ReadonlyArray<unknown>, B>(
          operation: OneClawOperation,
          run?: (...args: A) => Effect.Effect<B, OneClawError>,
        ) =>
        (...args: A) =>
          Ref.update(calls, (previous) => [...previous, operation]).pipe(
            Effect.andThen(() =>
              run ? run(...args) : Effect.fail(oneClawError(operation, "UNSUPPORTED")),
            ),
          );
      const service: OneClawOperations = {
        connections: {
          upsert: observe("connections.upsert", scenario.connections?.upsert),
          findBySubject: observe(
            "connections.findBySubject",
            scenario.connections?.findBySubject ?? (() => Effect.succeed(Option.none())),
          ),
          get: observe("connections.get", scenario.connections?.get),
          bootstrapEmpty: observe(
            "connections.bootstrapEmpty",
            scenario.connections?.bootstrapEmpty,
          ),
          reissueClaim: observe("connections.reissueClaim", scenario.connections?.reissueClaim),
        },
        customers: {
          redeemClaim: observe("customers.redeemClaim", scenario.customers?.redeemClaim),
          getIdentity: observe("customers.getIdentity", scenario.customers?.getIdentity),
          enableDelegation: observe(
            "customers.enableDelegation",
            scenario.customers?.enableDelegation,
          ),
        },
        agents: {
          create: observe("agents.create", scenario.agents?.create),
          get: observe("agents.get", scenario.agents?.get),
          setRawSigningEnabled: observe(
            "agents.setRawSigningEnabled",
            scenario.agents?.setRawSigningEnabled,
          ),
        },
        signingKeys: {
          create: observe("signingKeys.create", scenario.signingKeys?.create),
          list: observe("signingKeys.list", scenario.signingKeys?.list),
          destroy: observe("signingKeys.destroy", scenario.signingKeys?.destroy),
        },
        signing: { signDigest: observe("signing.signDigest", scenario.signing?.signDigest) },
      };
      return Context.make(OneClawService, service).pipe(Context.add(OneClawTestControl, { calls }));
    }),
  );
