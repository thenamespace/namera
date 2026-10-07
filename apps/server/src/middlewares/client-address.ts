import { isIP, SocketAddress } from "node:net";

import { Effect, Option, Schema } from "effect";
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

export const ClientAddressMiddleware = HttpMiddleware.make((httpEffect) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const peer = Option.getOrUndefined(request.remoteAddress);
    let address = peer === undefined ? undefined : normalizeAddress(peer);
    let source = "socket";
    const forwarded = request.headers["x-forwarded-for"];

    // Deployment ingress overwrites both headers and must block direct origin access.
    const realIp = request.headers["x-real-ip"];
    const realAddress = realIp === undefined ? undefined : normalizeAddress(realIp.trim());
    const hops = forwarded?.split(",");
    const addresses = hops?.map((hop) => normalizeAddress(hop.trim()));
    const forwardedAddress =
      hops && hops.length <= 32 && addresses?.every((hop) => hop !== undefined)
        ? addresses[0]
        : undefined;
    const clientAddress = realAddress ?? forwardedAddress;
    if (clientAddress !== undefined) {
      address = clientAddress;
      source = "forwarded";
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
