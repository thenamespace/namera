import { Context, Effect, Layer, Ref } from "effect";

import { ChainName, getCoinType, type SubnameDTO } from "@thenamespace/offchain-manager";

import { EnsError } from "./error.js";
import { Ens, type EnsService } from "./service.js";

type Entry = { readonly name: SubnameDTO; readonly records: Record<string, unknown> };
export interface TestEnsService {
  readonly reset: Effect.Effect<void>;
  readonly failNextWrite: Effect.Effect<void>;
}
export class TestEns extends Context.Service<TestEns, TestEnsService>()("@namera-ai/ens/TestEns") {}
class State extends Context.Service<
  State,
  { names: Ref.Ref<ReadonlyMap<string, Entry>>; fail: Ref.Ref<boolean> }
>()("@namera-ai/ens/TestEnsState") {}
const StateLayer = Layer.effect(
  State,
  Effect.gen(function* () {
    return {
      names: yield* Ref.make<ReadonlyMap<string, Entry>>(new Map()),
      fail: yield* Ref.make(false),
    };
  }),
);

const ControllerLayer = Layer.effect(
  TestEns,
  Effect.gen(function* () {
    const { names, fail } = yield* State;
    return {
      reset: Effect.all([Ref.set(names, new Map()), Ref.set(fail, false)]).pipe(Effect.asVoid),
      failNextWrite: Ref.set(fail, true),
    };
  }),
);

const ServiceLayer = Layer.effect(
  Ens,
  Effect.gen(function* () {
    const { names, fail } = yield* State;
    const beforeWrite = Effect.gen(function* () {
      if (yield* Ref.getAndSet(fail, false))
        return yield* new EnsError({
          operation: "updateSubname",
          reason: "REQUEST_FAILED",
          cause: "Injected failure",
        });
    });
    const update = (fullName: string, change: (entry: Entry) => Entry) =>
      Effect.gen(function* () {
        yield* beforeWrite;
        const current = yield* Ref.get(names);
        const entry = current.get(fullName);
        if (!entry)
          return yield* new EnsError({
            operation: "updateSubname",
            reason: "NOT_FOUND",
            cause: fullName,
          });
        yield* Ref.update(names, (map) => new Map(map).set(fullName, change(entry)));
      });
    const record = (
      fullName: string,
      kind: "texts" | "addresses",
      key: string,
      value: string | null,
    ) =>
      update(fullName, (entry) => {
        const records = { ...entry.name[kind] };
        if (value === null) delete records[key];
        else records[key] = value;
        return { ...entry, name: { ...entry.name, [kind]: records } };
      });
    const service: EnsService = {
      createSubname: (request) =>
        Effect.gen(function* () {
          yield* beforeWrite;
          const fullName = `${request.label}.${request.parentName}`;
          const added = yield* Ref.modify(names, (current) => {
            if (current.has(fullName)) return [false, current] as const;
            const name: SubnameDTO = {
              id: fullName,
              fullName,
              parentName: request.parentName,
              label: request.label,
              ...(request.owner ? { owner: request.owner } : {}),
              namehash: "",
              texts: Object.fromEntries(
                (request.texts ?? []).map(({ key, value }) => [key, value]),
              ),
              addresses: Object.fromEntries(
                (request.addresses ?? []).map(({ chain, value }) => [
                  String(getCoinType(chain)),
                  value,
                ]),
              ),
              metadata: {},
              ...(request.contenthash ? { contenthash: request.contenthash } : {}),
            };
            return [true, new Map(current).set(fullName, { name, records: {} })] as const;
          });
          if (!added)
            return yield* new EnsError({
              operation: "createSubname",
              reason: "ALREADY_EXISTS",
              cause: fullName,
            });
        }),
      updateSubname: (name, request) =>
        update(name, (entry) => ({
          ...entry,
          name: {
            ...entry.name,
            ...(request.texts
              ? { texts: Object.fromEntries(request.texts.map(({ key, value }) => [key, value])) }
              : {}),
            ...(request.addresses
              ? {
                  addresses: Object.fromEntries(
                    request.addresses.map(({ chain, value }) => [
                      String(getCoinType(chain)),
                      value,
                    ]),
                  ),
                }
              : {}),
          },
        })),
      deleteSubname: (name) =>
        Ref.update(names, (current) => {
          const next = new Map(current);
          next.delete(name);
          return next;
        }),
      isSubnameAvailable: (name) =>
        Ref.get(names).pipe(Effect.map((current) => ({ isAvailable: !current.has(name) }))),
      getSingleSubname: (name) =>
        Ref.get(names).pipe(Effect.map((current) => current.get(name)?.name ?? null)),
      getFilteredSubnames: (query) =>
        Ref.get(names).pipe(
          Effect.map((current) => {
            const filtered = [...current.values()]
              .map((entry) => entry.name)
              .filter(
                (name) =>
                  (!query.owner || name.owner?.toLowerCase() === query.owner.toLowerCase()) &&
                  (!query.parentName || name.parentName === query.parentName),
              );
            const page = query.page ?? 1;
            const size = query.size ?? 50;
            return {
              totalItems: filtered.length,
              page,
              size,
              items: filtered.slice((page - 1) * size, page * size),
            };
          }),
        ),
      addAddressRecord: (name, chain, value) =>
        record(name, "addresses", String(getCoinType(chain)), value),
      deleteAddressRecord: (name, chain) =>
        record(name, "addresses", String(getCoinType(chain)), null),
      setDefaultEvmAddress: (name, value) =>
        record(name, "addresses", String(getCoinType(ChainName.Default)), value),
      addTextRecord: (name, key, value) => record(name, "texts", key, value),
      deleteTextRecord: (name, key) => record(name, "texts", key, null),
      getTextRecords: (name) =>
        Ref.get(names).pipe(Effect.map((current) => current.get(name)?.name.texts ?? {})),
      getTextRecord: (name, key) =>
        Ref.get(names).pipe(
          Effect.map((current) => ({ record: current.get(name)?.name.texts[key] ?? "" })),
        ),
      addDataRecord: (name, key, value) =>
        update(name, (entry) => ({ ...entry, records: { ...entry.records, [key]: value } })),
      deleteDataRecord: (name, key) =>
        update(name, (entry) => {
          const records = { ...entry.records };
          delete records[key];
          return { ...entry, records };
        }),
      getDataRecords: (name) =>
        Ref.get(names).pipe(Effect.map((current) => current.get(name)?.records ?? {})),
      getDataRecord: (name, key) =>
        Ref.get(names).pipe(
          Effect.map((current) => ({
            record: JSON.stringify(current.get(name)?.records[key] ?? null),
          })),
        ),
    };
    return Ens.of(service);
  }),
);

export const EnsTestLayer = Layer.mergeAll(ControllerLayer, ServiceLayer).pipe(
  Layer.provide(StateLayer),
);
