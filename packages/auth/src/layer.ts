import { Context, Effect, Layer } from "effect";

import { MagicLink, MagicLinkLive, type MagicLinkShape } from "./layers";

export type AuthShape = {
  magicLink: MagicLinkShape;
};

export class Auth extends Context.Tag("Auth")<Auth, AuthShape>() {}

export const AuthLive = Layer.effect(
  Auth,
  Effect.gen(function* () {
    const magicLink = yield* MagicLink;
    return Auth.of({
      magicLink,
    });
  }),
).pipe(Layer.provide(MagicLinkLive));
