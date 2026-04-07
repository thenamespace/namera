import type { SigInMagicLinkBody } from "@namera-ai/schema";

import { Effect } from "effect";

import { clientRuntime } from "@/lib/runtime";
import { ApiClient, Env } from "@/services";

export const getCurrentUser = async () =>
  clientRuntime.runPromise(
    Effect.gen(function* () {
      const client = yield* ApiClient.ApiClient;
      return yield* client.auth.currentUser();
    }).pipe(Effect.catchTag("Unauthorized", () => Effect.succeed(null))),
  );

export const signInWithMagicLink = async (
  data: Pick<SigInMagicLinkBody, "name" | "email">,
) =>
  clientRuntime.runPromise(
    Effect.gen(function* () {
      const client = yield* ApiClient.ApiClient;
      const env = yield* Env.Env;
      const successCallback = new URL("/dashboard", env.baseUrl);
      successCallback.searchParams.set("success", "true");

      const errorCallback = new URL("/auth", env.baseUrl);
      errorCallback.searchParams.set("success", "false");

      yield* client.auth.signInMagicLink({
        payload: {
          ...data,
          callbackUrl: successCallback,
          errorCallbackUrl: errorCallback,
          newUserCallbackUrl: successCallback,
        },
      });
      return yield* client.auth.currentUser();
    }).pipe(Effect.catchTag("Unauthorized", () => Effect.succeed(null))),
  );
