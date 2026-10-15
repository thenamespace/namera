import { expect, it } from "@effect/vitest";
import { Deferred, Effect, Layer, Ref } from "effect";
import { TestClock } from "effect/testing";

import { emailPolicy } from "../../src/data.js";
import { EmailJobs } from "../../src/jobs.js";
import { EmailWorkerLayer } from "../../src/worker.js";

it.effect.each([
  { name: "idle polling", failFirst: false },
  { name: "retrying a failed iteration", failFirst: true },
])("stops $name when the worker scope closes", ({ failFirst }) =>
  Effect.gen(function* () {
    const calls = yield* Ref.make(0);
    const first = yield* Deferred.make<void>();
    const second = yield* Deferred.make<void>();
    const jobs = Layer.succeed(EmailJobs, {
      enqueue: () => Effect.die("The worker must not enqueue jobs"),
      processOnce: Effect.gen(function* () {
        const count = yield* Ref.updateAndGet(calls, (value) => value + 1);
        if (count === 1) {
          yield* Deferred.succeed(first, undefined);
          if (failFirst) return yield* Effect.die("Synthetic iteration failure");
        }
        if (count === 2) yield* Deferred.succeed(second, undefined);
        return 0;
      }),
    });

    yield* Effect.scoped(
      Effect.gen(function* () {
        yield* Layer.build(EmailWorkerLayer.pipe(Layer.provide(jobs)));
        yield* Deferred.await(first);
        expect(yield* Ref.get(calls)).toBe(1);
        yield* TestClock.adjust(emailPolicy.workerPollInterval);
        yield* Deferred.await(second);
        expect(yield* Ref.get(calls)).toBe(2);
      }),
    );

    yield* TestClock.adjust("1 minute");
    expect(yield* Ref.get(calls)).toBe(2);
  }),
);
