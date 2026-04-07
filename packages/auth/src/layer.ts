import { Effect, Layer, ServiceMap } from "effect";

import * as MagicLink from "./services/magic-link";

export type Auth = {
  magicLink: MagicLink.MagicLink;
};

export const Auth = ServiceMap.Service<Auth>("Auth");

export const layer = Layer.effect(
  Auth,
  Effect.gen(function* () {
    const magicLink = yield* MagicLink.MagicLink;
    return Auth.of({
      magicLink,
    });
  }),
).pipe(Layer.provide(MagicLink.layer));
