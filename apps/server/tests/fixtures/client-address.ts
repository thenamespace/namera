import { Context, Effect, Layer, Ref } from "effect";

export class TestClientAddresses extends Context.Service<
  TestClientAddresses,
  { readonly next: Effect.Effect<string> }
>()("@namera-ai/server/test/TestClientAddresses") {
  static readonly layer = Layer.effect(
    TestClientAddresses,
    Effect.gen(function* () {
      const sequence = yield* Ref.make(0);

      return TestClientAddresses.of({
        next: Ref.updateAndGet(sequence, (value) => value + 1).pipe(
          Effect.map((value) => `2001:db8::${value.toString(16)}`),
        ),
      });
    }),
  );
}
