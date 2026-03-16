import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { RpcError, UnsupportedChain } from "@namera-ai/schema";
import { Schema } from "effect";

export const rpcGroup = HttpApiGroup.make("rpc").add(
  HttpApiEndpoint.post("proxy", "/rpc/:chainId")
    .setPath(
      Schema.Struct({
        chainId: Schema.NumberFromString,
      }),
    )
    .setPayload(Schema.Any)
    .addError(UnsupportedChain, { status: 400 })
    .addError(RpcError, { status: 500 })
    .addSuccess(Schema.Any, { status: 200 }),
);
