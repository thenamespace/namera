import type { SigInMagicLinkBody } from "@namera-ai/schema/dto";

import { Effect } from "effect";

import { clientRuntime } from "@/lib/runtime";
import { ApiClient, Env } from "@/services";

import { annotateDashboardRoute } from "../telemetry";

export const getCurrentUser = async () =>
  clientRuntime.runPromise(
    Effect.fn("auth.currentUser")(function* () {
      yield* annotateDashboardRoute();
      const client = yield* ApiClient.ApiClient;
      return yield* client.auth.currentUser();
    })().pipe(Effect.catchTag("Unauthorized", () => Effect.succeed(null))),
  );

export const listSessions = async () =>
  clientRuntime.runPromise(
    Effect.fn("auth.listSessions")(function* () {
      yield* annotateDashboardRoute();
      const client = yield* ApiClient.ApiClient;
      return yield* client.auth.listSessions();
    })(),
  );

export const signInWithMagicLink = async (
  data: Pick<SigInMagicLinkBody, "email">,
) =>
  clientRuntime.runPromise(
    Effect.fn("auth.magicLink.signIn")(function* () {
      yield* annotateDashboardRoute();
      yield* Effect.annotateCurrentSpan("auth.method", "magic_link");
      const client = yield* ApiClient.ApiClient;
      const env = yield* Env.Env;
      const successCallback = new URL("/dashboard", env.baseUrl);
      successCallback.searchParams.set("success", "true");
      const errorCallbackUrl = env.baseUrl;

      yield* client.magicLink.signIn({
        payload: {
          ...data,
          errorCallbackUrl,
          callbackUrl: successCallback,
          newUserCallbackUrl: successCallback,
        },
      });
      return yield* client.auth.currentUser();
    })().pipe(Effect.catchTag("Unauthorized", () => Effect.succeed(null))),
  );

export const logout = async () =>
  clientRuntime.runPromise(
    Effect.fn("auth.logout")(function* () {
      yield* annotateDashboardRoute();
      const client = yield* ApiClient.ApiClient;
      yield* client.auth.logout();
    })(),
  );

export * from "./user";
export * from "./organization";
