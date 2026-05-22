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

      yield* client.magicLink.signIn({
        payload: {
          ...data,
          callbackUrl: successCallback,
          newUserCallbackUrl: successCallback,
        },
      });
      return yield* client.auth.currentUser();
    }).pipe(Effect.catchTag("Unauthorized", () => Effect.succeed(null))),
  );

export const logout = async () =>
  clientRuntime.runPromise(
    Effect.gen(function* () {
      const client = yield* ApiClient.ApiClient;
      yield* client.auth.logout();
    }),
  );
