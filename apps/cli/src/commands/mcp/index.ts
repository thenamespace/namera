import { NodeCrypto } from "@effect/platform-node";
import { Effect, Layer, Option, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";

import { LocalMcpApi } from "#/services/mcp/api-client";
import { localMcpListener } from "#/services/mcp/listener";
import { LocalMcpOAuth } from "#/services/mcp/oauth-broker";
import { mcpOAuthUpstreamLayer } from "#/services/mcp/oauth-upstream";
import { LocalMcpApiOrigin, localMcpUrls } from "#/services/mcp/transport-security";
import { printValue } from "#/services/output";
import { resolveCliSessionSigner } from "#/services/session-keystore/index";

const start = Command.make(
  "start",
  {
    port: Flag.integer("port").pipe(
      Flag.withDefault(3847),
      Flag.withDescription("Loopback MCP port (1024–65535)"),
    ),
    host: Flag.string("host").pipe(
      Flag.withDefault("http://localhost:8080"),
      Flag.withDescription("Namera API origin, not a listener bind address"),
    ),
    maxGasCost: Flag.string("max-gas-cost-wei").pipe(
      Flag.optional,
      Flag.withDescription(
        "Maximum fee per self-funded operation; omission permits sponsored operations only",
      ),
    ),
  },
  Effect.fn("cli.mcp.start")(function* ({ port, host, maxGasCost }) {
    const apiOrigin = new URL(yield* Schema.decodeUnknownEffect(LocalMcpApiOrigin)(host)).origin;
    const urls = yield* Effect.try(() => localMcpUrls(port));
    const maxGasCostWei = Option.isSome(maxGasCost)
      ? yield* Schema.decodeUnknownEffect(
          Schema.BigIntFromString.check(Schema.isGreaterThanOrEqualToBigInt(0n)),
        )(maxGasCost.value)
      : undefined;
    const broker = LocalMcpOAuth.layer({ urls, apiOrigin }).pipe(
      Layer.provide(
        mcpOAuthUpstreamLayer({ urls, apiOrigin }).pipe(Layer.provide(FetchHttpClient.layer)),
      ),
      Layer.provide(NodeCrypto.layer),
    );
    const runtime = localMcpListener(urls).pipe(
      Layer.provide(
        Layer.mergeAll(
          broker,
          LocalMcpApi.layer({
            apiOrigin,
            resolveSessionSigner: resolveCliSessionSigner(apiOrigin, maxGasCostWei),
          }),
        ),
      ),
    );
    // Build before reporting readiness, and close the listener on interruption.
    yield* Layer.build(runtime);
    yield* printValue({
      endpoint: urls.resource,
      apiOrigin,
      authentication: "OAuth required; connect from your agent to authorize selected session keys",
      credentials: "In memory; restarting requires reauthorization",
    });
    return yield* Effect.never;
  }, Effect.scoped),
);

export const mcpCommand = Command.make("mcp").pipe(
  Command.withDescription("Run MCP locally with OAuth and imported session keys"),
  Command.withSubcommands([start]),
);
