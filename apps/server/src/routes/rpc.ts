import { Effect, Redacted } from "effect";

import { HttpBody, HttpClient } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { api } from "@namera-ai/api";
import { getChainFromId, RpcError, UnsupportedChain } from "@namera-ai/schema";

import * as Env from "../env";

export const RpcGroupLive = HttpApiBuilder.group(api, "rpc", (handlers) =>
  handlers.handle("proxy", ({ params, payload }) =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const env = yield* Env.Env;

      const chainId = params.chainId;
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
          Effect.catch((e) =>
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
        Effect.catchTag("HttpClientError", (e) =>
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
