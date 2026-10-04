import { Effect } from "effect";
import type { HttpClientResponse } from "effect/http";
import type { HttpApiClient } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";

import { handledApi } from "./http-api-test.js";
import { TestAuthToken, TestDatabase, TestEmails, TestEns } from "./layers/index.js";

export type TestApiClient = HttpApiClient.ForApi<typeof NameraApi>;

export const makeTestApiClient = handledApi(NameraApi);

export const resetTestState = Effect.fn("server.resetTestState")(function* () {
  const database = yield* TestDatabase;
  const emails = yield* TestEmails;
  const authToken = yield* TestAuthToken;
  const ens = yield* TestEns;

  yield* database.reset;
  yield* emails.clear;
  yield* authToken.clear;
  yield* authToken.clearApiKey;
  yield* ens.reset;
});

export const setApiKey = Effect.fn("server.setApiKey")(function* (apiKey?: string) {
  const authToken = yield* TestAuthToken;
  yield* apiKey === undefined ? authToken.clearApiKey : authToken.setApiKey(apiKey);
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
