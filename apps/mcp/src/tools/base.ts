import { Tool, Toolkit } from "@effect/ai";
import { Effect, Schema } from "effect";

const Greet = Tool.make("greet", {
  description: "Greet a person",
  failure: Schema.Never,
  parameters: {
    name: Schema.String.annotations({
      description: "The name of the person to greet",
    }),
  },
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
