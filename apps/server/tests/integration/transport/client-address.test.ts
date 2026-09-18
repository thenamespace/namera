import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import {
  ClientAddressMiddleware,
  TrustedProxies,
  TrustedProxyConfig,
} from "../../../src/middlewares/client-address.js";
import { RateLimitMiddleware } from "../../../src/middlewares/rate-limit.js";
import { clientIdentifier, RateLimiterLive } from "../../../src/rate-limit.js";

const requestFor = (peer: string | undefined, forwarded?: string) =>
  HttpServerRequest.fromWeb(
    new Request("https://api.example.com/health", {
      headers: {
        ...(forwarded === undefined ? {} : { "x-forwarded-for": forwarded }),
        "x-real-ip": "198.51.100.99",
        "cf-connecting-ip": "198.51.100.99",
      },
    }),
  ).modify({ remoteAddress: Option.fromUndefinedOr(peer) });

const loadProxies = (value: string) =>
  TrustedProxyConfig.parse(ConfigProvider.fromUnknown({ SERVER_TRUSTED_PROXY_CIDRS: value }));

it.effect.each([
  {
    name: "disabled by default",
    trust: "",
    peer: "10.0.0.1",
    forwarded: "198.51.100.1",
    expected: "10.0.0.1",
  },
  {
    name: "untrusted socket",
    trust: "10.0.0.0/24",
    peer: "203.0.113.1",
    forwarded: "198.51.100.1",
    expected: "203.0.113.1",
  },
  {
    name: "trusted socket",
    trust: "10.0.0.0/24",
    peer: "10.0.0.1",
    forwarded: "198.51.100.1",
    expected: "198.51.100.1",
  },
  {
    name: "exact IP trust",
    trust: "10.0.0.1",
    peer: "10.0.0.1",
    forwarded: "198.51.100.1",
    expected: "198.51.100.1",
  },
  {
    name: "missing header ignores other IP headers",
    trust: "10.0.0.1",
    peer: "10.0.0.1",
    forwarded: undefined,
    expected: "10.0.0.1",
  },
  {
    name: "missing socket cannot trust headers",
    trust: "10.0.0.1",
    peer: undefined,
    forwarded: "198.51.100.1",
    expected: "unknown",
  },
  {
    name: "forged prefix stops at client",
    trust: "10.0.0.0/24",
    peer: "10.0.0.1",
    forwarded: "198.51.100.99, 203.0.113.2",
    expected: "203.0.113.2",
  },
  {
    name: "multiple trusted proxies",
    trust: "10.0.0.0/24, 2001:db8:1::/48",
    peer: "10.0.0.1",
    forwarded: "198.51.100.1, 2001:db8:1::2",
    expected: "198.51.100.1",
  },
  {
    name: "untrusted intermediate proxy",
    trust: "10.0.0.0/24",
    peer: "10.0.0.1",
    forwarded: "198.51.100.1, 203.0.113.2",
    expected: "203.0.113.2",
  },
  {
    name: "IPv4-mapped socket",
    trust: "10.0.0.0/24",
    peer: "::ffff:10.0.0.1",
    forwarded: "::ffff:c633:6401",
    expected: "198.51.100.1",
  },
  {
    name: "canonical IPv6",
    trust: "2001:db8:1::/48",
    peer: "2001:db8:1::1",
    forwarded: "2001:0db8:0002:0:0:0:0:1",
    expected: "2001:db8:2::1",
  },
  {
    name: "empty hop",
    trust: "10.0.0.1",
    peer: "10.0.0.1",
    forwarded: "198.51.100.1,",
    expected: "10.0.0.1",
  },
  {
    name: "malformed hop",
    trust: "10.0.0.1",
    peer: "10.0.0.1",
    forwarded: "unknown, 198.51.100.1",
    expected: "10.0.0.1",
  },
  {
    name: "IP with port",
    trust: "10.0.0.1",
    peer: "10.0.0.1",
    forwarded: "198.51.100.1:1234",
    expected: "10.0.0.1",
  },
  {
    name: "IPv6 zone",
    trust: "10.0.0.1",
    peer: "10.0.0.1",
    forwarded: "fe80::1%eth0",
    expected: "10.0.0.1",
  },
  {
    name: "oversized chain",
    trust: "10.0.0.1",
    peer: "10.0.0.1",
    forwarded: Array.from({ length: 33 }, () => "198.51.100.1").join(","),
    expected: "10.0.0.1",
  },
])("resolves client IP: $name", ({ trust, peer, forwarded, expected }) =>
  Effect.gen(function* () {
    const proxies = yield* loadProxies(trust);
    const response = yield* ClientAddressMiddleware(
      Effect.map(clientIdentifier, (address) => HttpServerResponse.text(address)),
    ).pipe(
      Effect.provideService(TrustedProxies, proxies),
      Effect.provideService(HttpServerRequest.HttpServerRequest, requestFor(peer, forwarded)),
    );
    expect(yield* Effect.promise(() => HttpServerResponse.toWeb(response).text())).toBe(expected);
  }),
);

it.effect.each([
  "*",
  "0.0.0.0/0",
  "::/0",
  "10.0.0.1/33",
  "::1/129",
  "10.0.0.1/-1",
  "localhost",
  "10.0.0.1,",
  "10.0.0.1/24/1",
])("rejects invalid proxy configuration: %s", (value) =>
  Effect.gen(function* () {
    expect(yield* Effect.isFailure(loadProxies(value))).toBe(true);
  }),
);

it.effect("defaults to trusting no proxies when configuration is absent", () =>
  Effect.gen(function* () {
    const proxies = yield* TrustedProxyConfig.parse(ConfigProvider.fromUnknown({}));
    expect(proxies.check("127.0.0.1")).toBe(false);
    expect(proxies.check("10.0.0.1")).toBe(false);
  }),
);

it.effect(
  "separates clients behind one proxy and prevents spoofed prefixes bypassing a limit",
  () =>
    Effect.gen(function* () {
      const proxies = yield* loadProxies("10.0.0.0/24");
      const handler = ClientAddressMiddleware(
        RateLimitMiddleware(Effect.succeed(HttpServerResponse.empty({ status: 204 }))),
      ).pipe(Effect.provideService(TrustedProxies, proxies));
      const send = (forwarded: string) =>
        handler.pipe(
          Effect.provideService(
            HttpServerRequest.HttpServerRequest,
            requestFor("10.0.0.1", forwarded),
          ),
        );

      for (let index = 0; index < 120; index += 1) {
        expect((yield* send("198.51.100.1")).status).toBe(204);
      }
      const limited = yield* send("198.51.100.1");
      expect(limited.status).toBe(429);
      expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
      expect((yield* send("198.51.100.2")).status).toBe(204);
      expect((yield* send("203.0.113.99, 198.51.100.1")).status).toBe(429);
    }).pipe(Effect.provide(RateLimiterLive)),
);
