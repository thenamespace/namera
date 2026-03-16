import { createServerFn } from "@tanstack/react-start";

import { SigInMagicLinkBody } from "@namera-ai/schema";
import { Effect, Schema } from "effect";

import { ApiClient, Env } from "@/layers";
import { serverRuntime } from "@/runtime/server";

export const getCurrentUser = createServerFn({ method: "GET" }).handler(() =>
  serverRuntime.runPromise(
    Effect.gen(function* () {
      const client = yield* ApiClient;
      return yield* client.auth.currentUser();
    }).pipe(Effect.catchTag("Unauthorized", () => Effect.succeed(null))),
  ),
);

export const signInWithMagicLink = createServerFn({ method: "POST" })
  .inputValidator(
    Schema.standardSchemaV1(SigInMagicLinkBody.pick("email", "name")),
  )
  .handler(({ data }) =>
    serverRuntime.runPromise(
      Effect.gen(function* () {
        const client = yield* ApiClient;
        const env = yield* Env;
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
    ),
  );
