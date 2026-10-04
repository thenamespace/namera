import { BlockList, isIP, SocketAddress } from "node:net";

import { Config, Context, Effect, Layer, Option, Schema } from "effect";
import { HttpMiddleware, HttpServerRequest } from "effect/http";

const ipAddress = Schema.String.check(
  Schema.makeFilter(
    (value) =>
      (isIP(value) !== 0 && !value.includes("%")) ||
      "Expected an IPv4 or IPv6 address without a zone",
  ),
);
const decodeAddress = Schema.decodeUnknownOption(ipAddress);

const normalizeAddress = (value: string) => {
  if (Option.isNone(decodeAddress(value))) return undefined;
  const address = new SocketAddress({
    address: value,
    family: isIP(value) === 4 ? "ipv4" : "ipv6",
  }).address;
  return address.startsWith("::ffff:") ? address.slice(7) : address;
};

const proxyRange = Schema.String.check(
  Schema.makeFilter((value) => {
    const [address, prefix, ...rest] = value.split("/");
    if (!address || Option.isNone(decodeAddress(address)) || rest.length > 0) return false;
    if (prefix === undefined) return true;
    // A catch-all trust range would allow arbitrary clients to choose their IP.
    return (
      /^\d+$/.test(prefix) &&
      Number(prefix) > 0 &&
      Number(prefix) <= (isIP(address) === 4 ? 32 : 128)
    );
  }),
);

export const TrustedProxyConfig = Config.schema(
  Schema.String.check(
    Schema.makeFilter(
      (value) =>
        value.trim() === "" ||
        value.split(",").every((entry) => Schema.is(proxyRange)(entry.trim())) ||
        "Expected comma-separated proxy IPs or CIDRs (no /0 ranges)",
    ),
  ),
  "SERVER_TRUSTED_PROXY_CIDRS",
).pipe(
  Config.withDefault(""),
  Config.map((value) => {
    const ranges = new BlockList();
    for (const entry of value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)) {
      const [address = "", prefix] = entry.split("/");
      const family = isIP(address) === 4 ? "ipv4" : "ipv6";
      if (prefix === undefined) ranges.addAddress(address, family);
      else ranges.addSubnet(address, Number(prefix), family);
    }
    return ranges;
  }),
);

export class TrustedProxies extends Context.Service<TrustedProxies, BlockList>()(
  "@namera-ai/server/TrustedProxies",
) {
  static readonly layer = Layer.effect(this, TrustedProxyConfig);
}

export const ClientAddressMiddleware = HttpMiddleware.make((httpEffect) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const trustedProxies = yield* TrustedProxies;
    const peer = Option.getOrUndefined(request.remoteAddress);
    let address = peer === undefined ? undefined : normalizeAddress(peer);
    let source = "socket";
    const forwarded = request.headers["x-forwarded-for"];

    if (
      address &&
      trustedProxies.check(address, isIP(address) === 4 ? "ipv4" : "ipv6") &&
      forwarded
    ) {
      const hops = forwarded.split(",");
      const addresses = hops.map((hop) => normalizeAddress(hop.trim()));
      // Reject ambiguous chains as a whole rather than skipping a malformed hop.
      if (hops.length <= 32 && addresses.every((hop) => hop !== undefined)) {
        for (const hop of addresses.toReversed()) {
          if (!trustedProxies.check(address, isIP(address) === 4 ? "ipv4" : "ipv6")) break;
          address = hop;
          source = "forwarded";
        }
      }
    }

    // Effect's outer HTTP tracer retains the socket peer in client.address.
    // Keep the resolved limiter identity separate for production verification.
    yield* Effect.annotateCurrentSpan({
      "namera.client.ip_source": source,
      ...(address === undefined ? {} : { "namera.client.address": address }),
    });

    return yield* Effect.provideService(
      httpEffect,
      HttpServerRequest.HttpServerRequest,
      request.modify({
        remoteAddress: address === undefined ? request.remoteAddress : Option.some(address),
      }),
    );
  }),
);
