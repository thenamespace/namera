import { Context, Effect, Layer, Ref } from "effect";

import { EnsError } from "./error.js";
import { Ens, type EnsService } from "./service.js";

export interface TestEnsService {
  readonly reset: Effect.Effect<void>;
}

export class TestEns extends Context.Service<TestEns, TestEnsService>()("@namera-ai/ens/TestEns") {}

class TestEnsState extends Context.Service<TestEnsState, Ref.Ref<ReadonlySet<string>>>()(
  "@namera-ai/ens/TestEnsState",
) {}

const TestEnsStateLayer = Layer.effect(TestEnsState, Ref.make<ReadonlySet<string>>(new Set()));

const TestEnsControllerLayer = Layer.effect(
  TestEns,
  Effect.map(TestEnsState, (names) => TestEns.of({ reset: Ref.set(names, new Set()) })),
);

const TestEnsServiceLayer = Layer.effect(
  Ens,
  Effect.gen(function* () {
    const names = yield* TestEnsState;

    const service: EnsService = {
      createSubname: Effect.fn("ens.test.createSubname")(function* (request) {
        const fullName = `${request.label}.${request.parentName}`;
        const added = yield* Ref.modify(names, (current) => {
          if (current.has(fullName)) return [false, current] as const;
          return [true, new Set([...current, fullName])] as const;
        });
        if (!added) {
          return yield* new EnsError({
            operation: "createSubname",
            reason: "ALREADY_EXISTS",
            cause: fullName,
          });
        }
      }),
      updateSubname: () => Effect.void,
      deleteSubname: (fullName) =>
        Ref.update(names, (current) => {
          const next = new Set(current);
          next.delete(fullName);
          return next;
        }),
      isSubnameAvailable: (fullName) =>
        Ref.get(names).pipe(Effect.map((current) => ({ isAvailable: !current.has(fullName) }))),
      getSingleSubname: () => Effect.succeed(null),
      getFilteredSubnames: (query) =>
        Effect.succeed({
          totalItems: 0,
          page: query.page ?? 1,
          size: query.size ?? 50,
          items: [],
        }),
      addAddressRecord: () => Effect.void,
      deleteAddressRecord: () => Effect.void,
      setDefaultEvmAddress: () => Effect.void,
      addTextRecord: () => Effect.void,
      deleteTextRecord: () => Effect.void,
      getTextRecords: () => Effect.succeed({}),
      getTextRecord: () => Effect.succeed({ record: "" }),
      addDataRecord: () => Effect.void,
      deleteDataRecord: () => Effect.void,
      getDataRecords: () => Effect.succeed({}),
      getDataRecord: () => Effect.succeed({ record: "" }),
    };

    return Ens.of(service);
  }),
);

export const EnsTestLayer = Layer.mergeAll(TestEnsControllerLayer, TestEnsServiceLayer).pipe(
  Layer.provide(TestEnsStateLayer),
);
