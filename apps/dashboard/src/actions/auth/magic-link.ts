import type { SigInMagicLinkBody } from "@namera-ai/schema/dto";

import { Effect } from "effect";

import { annotateDashboardRoute } from "@/actions/telemetry";
import { atomRuntime } from "@/lib/atom";
import { ApiClient, Env } from "@/services";

export const signInWithMagicLink = atomRuntime.fn<
  Pick<SigInMagicLinkBody, "email">
>()(
  Effect.fn("auth.magicLink.signIn")(function* (data) {
    yield* annotateDashboardRoute();
    const client = yield* ApiClient.ApiClient;
    const env = yield* Env.Env;
    const successCallbackUrl = new URL("/dashboard", env.baseUrl);
    successCallbackUrl.searchParams.set("success", "true");
    const errorCallbackUrl = new URL("/dashboard", env.baseUrl);
    errorCallbackUrl.searchParams.set("success", "false");

    yield* client.magicLink.signIn({
      payload: {
        ...data,
        callbackUrl: successCallbackUrl,
        newUserCallbackUrl: successCallbackUrl,
        errorCallbackUrl,
      },
    });
  }),
);
