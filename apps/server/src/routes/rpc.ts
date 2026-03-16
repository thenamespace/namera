import { HttpApiBuilder, HttpBody, HttpClient } from "@effect/platform";
import { api } from "@namera-ai/api";
import { getChainFromId, RpcError, UnsupportedChain } from "@namera-ai/schema";
import { Effect, Redacted } from "effect";

import { Env } from "@/env";

export const RpcGroupLive = HttpApiBuilder.group(api, "rpc", (handlers) =>
  handlers.handle("proxy", ({ path, payload }) =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const env = yield* Env;
      const chainId = path.chainId;

      const chain = getChainFromId(chainId);

      if (!chain) return yield* Effect.fail(new UnsupportedChain({ chainId }));
      const apiKey = Redacted.value(env.alchemyApiKey);

      const upstreamUrl = `https://${chain.key}.g.alchemy.com/v2/${apiKey}`;

      const res = yield* client
        .post(upstreamUrl, {
          acceptJson: true,
          body: HttpBody.raw(JSON.stringify(payload)),
        })
        .pipe(
          Effect.catchAll((e) =>
            Effect.fail(
              new RpcError({
                message: e.message,
                name: e.name,
                stack: e.stack,
              }),
            ),
          ),
        );

      const body = yield* res.json.pipe(
        Effect.catchTag("ResponseError", (e) =>
          Effect.fail(
            new RpcError({
              message: e.message,
              name: e.name,
              stack: e.stack,
            }),
          ),
        ),
      );
      return body;
    }),
  ),
);
