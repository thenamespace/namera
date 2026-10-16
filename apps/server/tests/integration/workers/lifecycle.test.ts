import { expect, it } from "@effect/vitest";
import { Array as EffectArray, Deferred, Effect, Layer, Logger, Random, Ref } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";

import { BillingWorkerLayer } from "#/workers/billing";
import { ExecutionWorkerLayer } from "#/workers/execution";
import { SessionKeyWorkerLayer } from "#/workers/session-key";
import { WalletOperationWorkerLayer } from "#/workers/wallet-operation";

import { TestServerLayer } from "../../fixtures/layers/index.js";

it.layer(TestServerLayer)("worker lifecycle", (test) => {
  test.effect("backs off wallet failures, caps the delay and resets after success", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(0);
      const app = yield* Application;
      const calls = yield* Ref.make(0);
      const started = yield* Effect.forEach(Array.from({ length: 8 }), () => Deferred.make<void>());
      const reconcile = () =>
        Effect.gen(function* () {
          const count = yield* Ref.getAndUpdate(calls, (value) => value + 1);
          yield* Deferred.succeed(EffectArray.getUnsafe(started, count), undefined);
          if (count !== 5 && count !== 7) return yield* Effect.die("Synthetic polling failure");
          return 0;
        });
      const application = Layer.succeed(Application, {
        ...app,
        wallet: { ...app.wallet, transactions: { ...app.wallet.transactions, reconcile } },
      });

      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* Layer.build(WalletOperationWorkerLayer.pipe(Layer.provide(application)));
          yield* Deferred.await(EffectArray.getUnsafe(started, 0));
          const delays = [10, 20, 40, 60, 60, 5, 10];
          for (const [index, seconds] of delays.entries()) {
            yield* TestClock.adjust(seconds * 1000 - 1);
            expect(yield* Ref.get(calls)).toBe(index + 1);
            yield* TestClock.adjust(1);
            yield* Deferred.await(EffectArray.getUnsafe(started, index + 1));
            expect(yield* Ref.get(calls)).toBe(index + 2);
          }
        }).pipe(
          Effect.provideService(Random.Random, {
            nextDoubleUnsafe: () => 0.5,
            nextIntUnsafe: () => 0,
          }),
        ),
      );

      yield* TestClock.adjust("10 minutes");
      expect(yield* Ref.get(calls)).toBe(8);
    }),
  );

  test.effect("interrupts an in-flight wallet poll without logging failure or restarting", () =>
    Effect.gen(function* () {
      const app = yield* Application;
      const started = yield* Deferred.make<void>();
      const interrupted = yield* Ref.make(false);
      const calls = yield* Ref.make(0);
      const messages: unknown[] = [];
      const application = Layer.succeed(Application, {
        ...app,
        wallet: {
          ...app.wallet,
          transactions: {
            ...app.wallet.transactions,
            reconcile: () =>
              Ref.update(calls, (count) => count + 1).pipe(
                Effect.andThen(Deferred.succeed(started, undefined)),
                Effect.andThen(Effect.never),
                Effect.onInterrupt(() => Ref.set(interrupted, true)),
              ),
          },
        },
      });

      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* Layer.build(WalletOperationWorkerLayer.pipe(Layer.provide(application)));
          yield* Deferred.await(started);
        }),
      ).pipe(Effect.provide(Logger.layer([Logger.make(({ message }) => messages.push(message))])));

      yield* TestClock.adjust("10 minutes");
      expect(yield* Ref.get(interrupted)).toBe(true);
      expect(yield* Ref.get(calls)).toBe(1);
      expect(messages.flat()).toContain("wallet_operation.worker.stopped");
      expect(messages.flat()).not.toContain("wallet_operation.worker.failed");
    }),
  );

  test.effect("polls sponsorship every ten seconds and maintenance once per minute", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(0);
      const app = yield* Application;
      const calls = yield* Ref.make<ReadonlyArray<string>>([]);
      const started = yield* Effect.forEach(Array.from({ length: 7 }), () => Deferred.make<void>());
      const record = Effect.fnUntraced(function* (kind: string) {
        const current = yield* Ref.updateAndGet(calls, (values) => [...values, kind]);
        yield* Deferred.succeed(EffectArray.getUnsafe(started, current.length - 1), undefined);
      });
      const application = Layer.succeed(Application, {
        ...app,
        billing: {
          ...app.billing,
          reconcile: () =>
            record("maintenance").pipe(Effect.as({ rolledOver: 0, recovered: 0, repaired: 0 })),
          reconcileSponsorships: () => record("sponsorship").pipe(Effect.as(0)),
        },
      });

      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* Layer.build(BillingWorkerLayer.pipe(Layer.provide(application)));
          yield* Deferred.await(EffectArray.getUnsafe(started, 0));
          for (let index = 1; index < started.length; index += 1) {
            yield* TestClock.adjust("10 seconds");
            yield* Deferred.await(EffectArray.getUnsafe(started, index));
          }
          expect(yield* Ref.get(calls)).toEqual([
            "maintenance",
            "sponsorship",
            "sponsorship",
            "sponsorship",
            "sponsorship",
            "sponsorship",
            "maintenance",
          ]);
        }),
      );

      yield* TestClock.adjust("2 minutes");
      expect((yield* Ref.get(calls)).length).toBe(7);
    }),
  );

  test.effect.each([
    { kind: "execution", failFirst: false },
    { kind: "execution", failFirst: true },
    { kind: "session", failFirst: false },
    { kind: "session", failFirst: true },
    { kind: "deactivation", failFirst: false },
    { kind: "deactivation", failFirst: true },
  ] as const)("yields and stops $kind polling (failure=$failFirst)", ({ kind, failFirst }) =>
    Effect.gen(function* () {
      const app = yield* Application;
      const calls = yield* Ref.make(0);
      const first = yield* Deferred.make<void>();
      const second = yield* Deferred.make<void>();
      const reconcile = () =>
        Effect.gen(function* () {
          const count = yield* Ref.updateAndGet(calls, (value) => value + 1);
          yield* Deferred.succeed(count === 1 ? first : second, undefined);
          if (count === 1 && failFirst) return yield* Effect.die("Synthetic iteration failure");
          return 0;
        });
      const application = Layer.succeed(Application, {
        ...app,
        execution: { ...app.execution, reconcile },
        sessionKey: {
          ...app.sessionKey,
          ...(kind === "deactivation"
            ? { reconcileDeactivations: reconcile }
            : { reconcileOperations: reconcile }),
        },
      });

      yield* Effect.scoped(
        Effect.gen(function* () {
          const worker = kind === "execution" ? ExecutionWorkerLayer : SessionKeyWorkerLayer;
          yield* Layer.build(worker.pipe(Layer.provide(application)));
          yield* Deferred.await(first);
          yield* TestClock.adjust(4999);
          expect(yield* Ref.get(calls)).toBe(1);
          yield* TestClock.adjust(1);
          yield* Deferred.await(second);
          expect(yield* Ref.get(calls)).toBe(2);
        }),
      );

      yield* TestClock.adjust("1 minute");
      expect(yield* Ref.get(calls)).toBe(2);
    }),
  );
});
