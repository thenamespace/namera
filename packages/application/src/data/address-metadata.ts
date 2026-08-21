import { DateTime, Effect, Result } from "effect";

import { Repository } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import {
  AddressMetadataUnavailableError,
  type EthereumAddress,
  type SupportedEvmChainId,
} from "@namera-ai/protocol";
import type { EvmAddressMetadataData } from "@namera-ai/protocol/model";

const DAY = 24 * 60 * 60 * 1_000;

const cacheDuration = (data: EvmAddressMetadataData): number =>
  data.kind === "unknown" ||
  data.contract?.proxyType !== null ||
  data.trust.reputation === "scam" ||
  data.trust.reputation === "suspicious"
    ? DAY
    : 30 * DAY;

const keyOf = (chainId: SupportedEvmChainId, address: EthereumAddress) =>
  `${chainId}:${address.toLowerCase()}`;

interface AddressReference {
  readonly namespace: "eip155";
  readonly chainId: SupportedEvmChainId;
  readonly address: EthereumAddress;
}

export interface AddressMetadataApplication {
  readonly get: (
    input: AddressReference,
  ) => Effect.Effect<EvmAddressMetadataData, AddressMetadataUnavailableError>;
  readonly resolve: (input: {
    readonly addresses: ReadonlyArray<AddressReference>;
  }) => Effect.Effect<ReadonlyArray<EvmAddressMetadataData>, AddressMetadataUnavailableError>;
  readonly search: (input: {
    readonly namespace: "eip155";
    readonly chainId: SupportedEvmChainId;
    readonly query: string;
  }) => Effect.Effect<ReadonlyArray<EvmAddressMetadataData>>;
  readonly store: (
    values: ReadonlyArray<EvmAddressMetadataData>,
  ) => Effect.Effect<ReadonlyArray<EvmAddressMetadataData>>;
}

export const makeAddressMetadataApplication = Effect.gen(function* () {
  const repository = yield* Repository;
  const evm = yield* Evm;

  const persist = Effect.fn("application.addressMetadata.persist")(
    function* (values: ReadonlyArray<EvmAddressMetadataData>) {
      if (values.length === 0) return [];
      const rows = values.map((data) => ({
        namespace: data.namespace,
        chainId: data.chainId,
        address: data.address,
        data,
        observedAt: data.provenance.observedAt,
        refreshAfter: DateTime.addDuration(data.provenance.observedAt, cacheDuration(data)),
      }));
      return yield* repository.core.addressMetadata.upsertMany(rows);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const store = Effect.fn("application.addressMetadata.store")(function* (
    values: ReadonlyArray<EvmAddressMetadataData>,
  ) {
    if (values.length === 0) return [];
    const keys = values.map((value) => ({
      namespace: value.namespace,
      chainId: value.chainId,
      address: value.address,
    }));
    const existing = yield* repository.core.addressMetadata
      .findMany(keys)
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
    const existingByKey = new Map(
      existing.map((row) => [keyOf(row.chainId, row.address), row.data]),
    );
    const updates = values.filter((value) => {
      const current = existingByKey.get(keyOf(value.chainId, value.address));
      return (
        current === undefined ||
        value.tags.length > current.tags.length ||
        (current.tags.length === 0 &&
          current.trust.isSourceVerified === null &&
          current.trust.reputation !== value.trust.reputation)
      );
    });
    const persisted = yield* persist(updates);
    const dataByKey = new Map([
      ...existingByKey,
      ...persisted.map((row) => [keyOf(row.chainId, row.address), row.data] as const),
    ]);
    return values.flatMap((value) => {
      const data = dataByKey.get(keyOf(value.chainId, value.address));
      return data === undefined ? [] : [data];
    });
  });

  const resolve = Effect.fn("application.addressMetadata.resolve")(function* (input: {
    readonly addresses: ReadonlyArray<{
      readonly namespace: "eip155";
      readonly chainId: SupportedEvmChainId;
      readonly address: EthereumAddress;
    }>;
  }) {
    const unique = Array.from(
      new Map(input.addresses.map((item) => [keyOf(item.chainId, item.address), item])).values(),
    );
    const cached = yield* repository.core.addressMetadata
      .findMany(unique)
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
    const cachedByKey = new Map(cached.map((row) => [keyOf(row.chainId, row.address), row]));
    const now = yield* DateTime.now;
    const stale = unique.filter((item) => {
      const row = cachedByKey.get(keyOf(item.chainId, item.address));
      return (
        row === undefined || DateTime.toEpochMillis(row.refreshAfter) <= DateTime.toEpochMillis(now)
      );
    });
    const byChain = new Map<SupportedEvmChainId, Array<AddressReference>>();
    for (const item of stale) {
      const items = byChain.get(item.chainId) ?? [];
      items.push(item);
      byChain.set(item.chainId, items);
    }
    const refreshed = yield* Effect.forEach(
      Array.from(byChain),
      ([chainId, items]) =>
        evm.addressMetadata
          .resolve({ chainId, addresses: items.map((item) => item.address) })
          .pipe(Effect.flatMap(persist), Effect.result),
      { concurrency: 2 },
    );
    for (const result of refreshed) {
      if (Result.isSuccess(result)) {
        for (const row of result.success) cachedByKey.set(keyOf(row.chainId, row.address), row);
      }
    }
    const rows = unique.flatMap((item) => {
      const row = cachedByKey.get(keyOf(item.chainId, item.address));
      return row === undefined ? [] : [row];
    });
    if (rows.length === 0 && unique.length > 0) {
      return yield* new AddressMetadataUnavailableError({
        code: "ADDRESS_METADATA_UNAVAILABLE",
      });
    }
    return rows.map((row) => row.data);
  });

  const get = Effect.fn("application.addressMetadata.get")(function* (input: {
    readonly namespace: "eip155";
    readonly chainId: SupportedEvmChainId;
    readonly address: EthereumAddress;
  }) {
    const items = yield* resolve({ addresses: [input] });
    const item = items[0];
    if (item === undefined) {
      return yield* new AddressMetadataUnavailableError({
        code: "ADDRESS_METADATA_UNAVAILABLE",
      });
    }
    return item;
  });

  const search = Effect.fn("application.addressMetadata.search")(function* (input: {
    readonly namespace: "eip155";
    readonly chainId: SupportedEvmChainId;
    readonly query: string;
  }) {
    const local = yield* repository.core.addressMetadata
      .search({ ...input, limit: 20 })
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
    if (local.length >= 10) return local.map((row) => row.data);
    const addresses = yield* evm.addressMetadata
      .search(input)
      .pipe(Effect.catch(() => Effect.succeed([])));
    const remote =
      addresses.length === 0
        ? []
        : yield* resolve({
            addresses: addresses.slice(0, 20).map((address) => ({
              namespace: input.namespace,
              chainId: input.chainId,
              address,
            })),
          }).pipe(Effect.catch(() => Effect.succeed([])));
    return Array.from(
      new Map(
        [...local.map((row) => row.data), ...remote].map((item) => [item.address, item]),
      ).values(),
    ).slice(0, 20);
  });

  return { get, resolve, search, store } satisfies AddressMetadataApplication;
});
