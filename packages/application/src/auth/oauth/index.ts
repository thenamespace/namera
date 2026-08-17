import { Effect } from "effect";

import { makeOAuthAuthorizationApplication } from "./authorization.js";
import { makeOAuthDeviceApplication } from "./device.js";
import { makeOAuthRegistrationApplication } from "./registration.js";
import { makeOAuthRequestApplication } from "./request.js";
import { makeOAuthTokenApplication } from "./token.js";

export const makeOAuthApplication = Effect.gen(function* () {
  const request = yield* makeOAuthRequestApplication;
  const registration = yield* makeOAuthRegistrationApplication;
  const authorization = yield* makeOAuthAuthorizationApplication;
  const token = yield* makeOAuthTokenApplication;
  const device = yield* makeOAuthDeviceApplication(token);
  return { request, registration, authorization, device, token };
});

export * from "./authorization.js";
export * from "./device.js";
export * from "./request.js";
export * from "./registration.js";
export * from "./token.js";
