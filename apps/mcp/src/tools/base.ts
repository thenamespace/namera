import { Effect, Schema } from "effect";
import { Tool, Toolkit } from "effect/unstable/ai";

const Greet = Tool.make("greet", {
  description: "Greet a person",
  failure: Schema.Never,
  parameters: Schema.Struct({
    name: Schema.String.annotate({
      description: "The name of the person to greet",
    }),
  }),
  success: Schema.String,
});

export const BaseTools = Toolkit.make(Greet);

export const BaseToolsHandlers = BaseTools.toLayer(
  Effect.gen(function* () {
    return {
      greet: ({ name }) => Effect.succeed(`Hello, ${name}!`),
    };
  }),
);
