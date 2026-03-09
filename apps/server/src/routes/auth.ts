import { HttpApiBuilder } from "@effect/platform";
import { api } from "@repo/api";
import { Auth } from "@repo/auth";
import type { SigInMagicLinkBody } from "@repo/schema";
import { Effect } from "effect";

const signInMagicLinkHandler = (payload: SigInMagicLinkBody) =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    yield* auth.magicLink.signInMagicLink(payload);
  });

export const AuthGroupLive = HttpApiBuilder.group(api, "auth", (handlers) =>
  handlers.handle("signInMagicLink", ({ payload }) =>
    signInMagicLinkHandler(payload),
  ),
);
