import { Effect } from "effect";
import type { HttpClientResponse } from "effect/unstable/http";
import type { HttpApiClient } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";

import { TestAuthToken, TestDatabase, TestEmails } from "../layers/index.js";
import { handledApi } from "./http-api-test.js";

export type TestApiClient = HttpApiClient.ForApi<typeof NameraApi>;

export const makeTestApiClient = handledApi(NameraApi);

export const resetTestState = Effect.fn("server.resetTestState")(function* () {
  const database = yield* TestDatabase;
  const emails = yield* TestEmails;
  const authToken = yield* TestAuthToken;

  yield* database.reset;
  yield* emails.clear;
  yield* authToken.clear;
});

export const setAuthToken = Effect.fn("server.setAuthToken")(function* (token?: string) {
  const authToken = yield* TestAuthToken;
  yield* token === undefined ? authToken.clear : authToken.set(token);
});

export const useAuthCookie = Effect.fn("server.useAuthCookie")(function* (
  response: HttpClientResponse.HttpClientResponse,
) {
  const cookie = response.cookies.cookies["auth-token"];
  if (cookie === undefined || cookie.value.length === 0) {
    return yield* Effect.die("Expected response to set auth-token cookie");
  }

  const authToken = yield* TestAuthToken;
  yield* authToken.set(cookie.value);
  return cookie;
});
