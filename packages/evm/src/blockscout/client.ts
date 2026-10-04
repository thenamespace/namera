import { Duration, Effect, Redacted, Schema } from "effect";
import { HttpClientRequest } from "effect/http";
import type { HttpClient } from "effect/http";

import { EvmDataProviderError, type SupportedEvmChainId } from "@namera-ai/protocol";

import { getChainDataByCaip2 } from "../chains/helpers.js";
import type { EvmConfigValues } from "../config.js";

export type BlockscoutOperation = EvmDataProviderError["operation"];

const chainBaseUrl = (chainId: SupportedEvmChainId): string => {
  const chain = getChainDataByCaip2(chainId);
  if (chain === undefined) throw new Error(`Unsupported Blockscout chain: ${chainId}`);
  return `https://api.blockscout.com/${chain.chain.id}/api/v2`;
};

export const makeBlockscoutClient = (
  config: EvmConfigValues,
  httpClient: HttpClient.HttpClient,
) => {
  const apiKey = Redacted.value(config.blockscoutApiKey);

  const execute = <S extends Schema.Constraint>(
    operation: BlockscoutOperation,
    request: HttpClientRequest.HttpClientRequest,
    schema: S,
  ) =>
    httpClient.execute(HttpClientRequest.bearerToken(request, apiKey)).pipe(
      Effect.flatMap((response) =>
        response.status >= 200 && response.status < 300
          ? response.json
          : Effect.fail(new Error(`Blockscout returned HTTP ${response.status}`)),
      ),
      Effect.timeout(Duration.seconds(15)),
      Effect.retry({ times: 2 }),
      Effect.mapError(
        (cause) => new EvmDataProviderError({ operation, code: "PROVIDER_UNAVAILABLE", cause }),
      ),
      Effect.flatMap(Schema.decodeUnknownEffect(schema)),
      Effect.mapError((cause) =>
        cause instanceof EvmDataProviderError
          ? cause
          : new EvmDataProviderError({ operation, code: "INVALID_PROVIDER_RESPONSE", cause }),
      ),
    );

  const get = <S extends Schema.Constraint>(
    operation: BlockscoutOperation,
    chainId: SupportedEvmChainId,
    path: string,
    schema: S,
    params: Readonly<Record<string, string>> = {},
  ) => {
    const request = HttpClientRequest.get(`${chainBaseUrl(chainId)}${path}`).pipe(
      HttpClientRequest.appendUrlParams(params),
      HttpClientRequest.setHeader("accept", "application/json"),
    );
    return execute(operation, request, schema);
  };

  const getMetadata = <S extends Schema.Constraint>(
    operation: BlockscoutOperation,
    schema: S,
    params: Readonly<Record<string, string>>,
  ) =>
    execute(
      operation,
      HttpClientRequest.get("https://api.blockscout.com/services/metadata/api/v1/metadata").pipe(
        HttpClientRequest.appendUrlParams(params),
        HttpClientRequest.setHeader("accept", "application/json"),
      ),
      schema,
    );

  return { get, getMetadata };
};

export type BlockscoutClient = ReturnType<typeof makeBlockscoutClient>;
