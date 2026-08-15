import { Effect } from "effect";

import { makeOAuthAuthorizationApplication } from "./authorization.js";
import { makeOAuthRequestApplication } from "./request.js";
import { makeOAuthTokenApplication } from "./token.js";

export const makeOAuthApplication = Effect.gen(function* () {
  const request = yield* makeOAuthRequestApplication;
  const authorization = yield* makeOAuthAuthorizationApplication;
  const token = yield* makeOAuthTokenApplication;
  return { request, authorization, token };
});

export * from "./authorization.js";
export * from "./request.js";
export * from "./token.js";
