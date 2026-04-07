import { Schema } from "effect";

import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import { RpcError, UnsupportedChain } from "@namera-ai/schema";

export const rpcGroup = HttpApiGroup.make("rpc").add(
  HttpApiEndpoint.post("proxy", "/rpc/:chainId", {
    params: {
      chainId: Schema.NumberFromString,
    },
    payload: Schema.Any,
    error: [
      UnsupportedChain.pipe(HttpApiSchema.status(400)),
      RpcError.pipe(HttpApiSchema.status(500)),
    ],
    success: Schema.Any.pipe(HttpApiSchema.status(200)),
  }),
);
