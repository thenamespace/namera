import { Effect, Layer, type Redacted, ServiceMap } from "effect";
import type { QuitError } from "effect/Terminal";
import { Prompt } from "effect/unstable/cli";
import type { Environment } from "effect/unstable/cli/Prompt";

export type PromptManagerShape = {
  selectPassword: (params: {
    message: string;
    validate?: (value: string) => Effect.Effect<string, string, never>;
  }) => Effect.Effect<Redacted.Redacted<string>, QuitError, Environment>;
};

export const PromptManager =
  ServiceMap.Service<PromptManagerShape>("PromptManager");

export const PromptManagerLive = Layer.effect(
  PromptManager,
  Effect.gen(function* () {
    return PromptManager.of({
      selectPassword: (params) =>
        Effect.gen(function* () {
          const password = yield* Prompt.password({
            message: params.message,
            validate: (v) =>
              Effect.gen(function* () {
                if (v.length < 8) {
                  return yield* Effect.fail(
                    "Password must be at least 8 characters long",
                  );
                }

                if (params.validate) v = yield* params.validate(v);

                return v;
              }),
          });

          return password;
        }),
    });
  }),
);
