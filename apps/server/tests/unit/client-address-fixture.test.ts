import { isIP } from "node:net";

import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { TestClientAddresses } from "../fixtures/client-address.js";

it.effect("allocates distinct valid client addresses beyond one IPv4 octet", () =>
  Effect.gen(function* () {
    const clients = yield* TestClientAddresses;
    const addresses = yield* Effect.all(
      Array.from({ length: 300 }, () => clients.next),
      { concurrency: "unbounded" },
    );

    expect(new Set(addresses).size).toBe(300);
    expect(addresses.every((address) => isIP(address) === 6)).toBe(true);
  }).pipe(Effect.provide(TestClientAddresses.layer)),
);

it.effect("does not carry client allocation state into a new fixture scope", () =>
  Effect.gen(function* () {
    const allocate = Effect.gen(function* () {
      const clients = yield* TestClientAddresses;
      return [yield* clients.next, yield* clients.next];
    });

    const firstScope = yield* allocate.pipe(Effect.provide(TestClientAddresses.layer));
    const nextScope = yield* allocate.pipe(Effect.provide(TestClientAddresses.layer));

    expect(nextScope).toEqual(firstScope);
    expect(firstScope[0]).not.toBe(firstScope[1]);
  }),
);
