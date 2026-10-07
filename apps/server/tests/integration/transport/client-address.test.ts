import { expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";

import { ClientAddressMiddleware } from "../../../src/middlewares/client-address.js";
import { RateLimitMiddleware } from "../../../src/middlewares/rate-limit.js";
import { clientIdentifier, RateLimiterLive } from "../../../src/rate-limit.js";

const requestFor = (peer: string | undefined, forwarded?: string, realIp?: string) =>
  HttpServerRequest.fromWeb(
    new Request("https://api.example.com/health", {
      headers: {
        ...(forwarded === undefined ? {} : { "x-forwarded-for": forwarded }),
        ...(realIp === undefined ? {} : { "x-real-ip": realIp }),
        "cf-connecting-ip": "198.51.100.99",
      },
    }),
  ).modify({ remoteAddress: Option.fromUndefinedOr(peer) });

it.effect.each([
  {
    name: "prefers real IP",
    realIp: "198.51.100.2",
    forwarded: "198.51.100.1",
    expected: "198.51.100.2",
  },
  {
    name: "real IP without forwarded header",
    realIp: "198.51.100.2",
    forwarded: undefined,
    expected: "198.51.100.2",
  },
  {
    name: "forwarded fallback",
    realIp: undefined,
    forwarded: "198.51.100.1, 10.0.0.2",
    expected: "198.51.100.1",
  },
  {
    name: "invalid real IP fallback",
    realIp: "unknown",
    forwarded: "198.51.100.1",
    expected: "198.51.100.1",
  },
  {
    name: "normalizes IPv6",
    realIp: " 2001:0db8:0002:0:0:0:0:1 ",
    forwarded: undefined,
    expected: "2001:db8:2::1",
  },
  {
    name: "normalizes IPv4 mapped IP",
    realIp: "::ffff:c633:6401",
    forwarded: undefined,
    expected: "198.51.100.1",
  },
  {
    name: "missing headers ignores other IP headers",
    realIp: undefined,
    forwarded: undefined,
    expected: "10.0.0.1",
  },
  {
    name: "malformed chain",
    realIp: undefined,
    forwarded: "198.51.100.1, unknown",
    expected: "10.0.0.1",
  },
  { name: "empty hop", realIp: undefined, forwarded: "198.51.100.1,", expected: "10.0.0.1" },
  {
    name: "port rejected",
    realIp: "198.51.100.1:1234",
    forwarded: undefined,
    expected: "10.0.0.1",
  },
  { name: "zone rejected", realIp: "fe80::1%eth0", forwarded: undefined, expected: "10.0.0.1" },
  {
    name: "oversized chain",
    realIp: undefined,
    forwarded: Array.from({ length: 33 }, () => "198.51.100.1").join(","),
    expected: "10.0.0.1",
  },
])("sanitized ingress headers: $name", ({ realIp, forwarded, expected }) =>
  Effect.gen(function* () {
    const response = yield* ClientAddressMiddleware(
      Effect.map(clientIdentifier, (address) => HttpServerResponse.text(address)),
    ).pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        requestFor("10.0.0.1", forwarded, realIp),
      ),
    );
    expect(yield* Effect.promise(() => HttpServerResponse.toWeb(response).text())).toBe(expected);
  }),
);

it.effect.each(["real", "forwarded"])("separates %s IP clients behind ingress", (header) =>
  Effect.gen(function* () {
    const handler = ClientAddressMiddleware(
      RateLimitMiddleware(Effect.succeed(HttpServerResponse.empty({ status: 204 }))),
    );
    const send = (address: string) =>
      handler.pipe(
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          requestFor(
            "10.0.0.1",
            header === "forwarded" ? address : undefined,
            header === "real" ? address : undefined,
          ),
        ),
      );
    for (let index = 0; index < 120; index += 1) {
      expect((yield* send("198.51.100.1")).status).toBe(204);
    }
    const limited = yield* send("198.51.100.1");
    expect(limited.status).toBe(429);
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    expect((yield* send("198.51.100.2")).status).toBe(204);
  }).pipe(Effect.provide(RateLimiterLive)),
);

it.effect.each([
  { realIp: "198.51.100.1", expected: "198.51.100.1" },
  { realIp: undefined, expected: "unknown" },
])("handles absent socket address: $realIp", ({ realIp, expected }) =>
  Effect.gen(function* () {
    const response = yield* ClientAddressMiddleware(
      Effect.map(clientIdentifier, (address) => HttpServerResponse.text(address)),
    ).pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        requestFor(undefined, undefined, realIp),
      ),
    );
    expect(yield* Effect.promise(() => HttpServerResponse.toWeb(response).text())).toBe(expected);
  }),
);
