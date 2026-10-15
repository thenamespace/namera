import { expect, it } from "vitest";

import { analyticsOptedOut } from "../../src/analytics/collection.js";
import { httpRouteTemplate } from "../../src/http.js";

it.each([
  [
    "/wallets/private-id/transactions/private-op/cancel?token=secret",
    "/wallets/:walletId/transactions/:operationId/cancel",
  ],
  [
    "https://api.example.test/session-keys/private-key?authorization=secret",
    "/session-keys/:sessionKeyId",
  ],
  ["/rpc/eip155/8453", "/rpc/eip155/:chainId"],
  ["/auth/session/me/?token=secret", "/auth/session/me"],
  ["/unknown/private-id?token=secret", "/*"],
])("normalizes %s without leaking identifiers into metric labels", (url, expected) => {
  expect(httpRouteTemplate(url)).toBe(expected);
});

it.each([
  { dnt: "1" },
  { "sec-gpc": "1" },
  { "x-namera-analytics": "off" },
  { cookie: "session=example;namera_analytics_disabled=true; other=value" },
])("honors request privacy signal %j", (headers) => {
  expect(analyticsOptedOut(headers)).toBe(true);
});

it.each([
  {},
  { dnt: "0", "sec-gpc": "0" },
  { cookie: "not_namera_analytics_disabled=true" },
  { cookie: "namera_analytics_disabled=false" },
])("does not infer opt-out from unrelated request values %j", (headers) => {
  expect(analyticsOptedOut(headers)).toBe(false);
});
