import { Effect, Layer } from "effect";

import { EmailLayer } from "./layer";

export const layer = Layer.succeed(
  EmailLayer,
  EmailLayer.of({
    sendEmail: Effect.fn("sendEmail")(function* (opts) {
      yield* Effect.log(`Sending Email to ${opts.to}`);
      yield* Effect.log(`Type: ${opts.template.type}`);
      yield* Effect.log(`Variables: ${opts.template.variables}`);
      return "";
    }),
    createContact: Effect.fn("createContact")(function* (opts) {
      yield* Effect.log("Created Contact with Email: ", opts.email);
      return "";
    }),
    updateContactSegments: Effect.fn("updateContactSegments")(function* (opts) {
      yield* Effect.log("Update Contact Segments: ", opts.segments);
      return "";
    }),
  }),
);
