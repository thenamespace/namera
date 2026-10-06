import { BigDecimal, Effect, Option, Redacted, Schema } from "effect";
import { HttpClientRequest, type HttpClient } from "effect/http";

import type { EvmExecutionReceipt } from "@namera-ai/protocol";

import { getChainDataByCaip2 } from "../chains/helpers.js";

export class SponsorshipCostError extends Schema.TaggedError<SponsorshipCostError>()(
  "SponsorshipCostError",
  {
    code: Schema.Literals([
      "NOT_CONFIGURED",
      "PROVIDER_UNAVAILABLE",
      "INVALID_RESPONSE",
      "PAGE_LIMIT",
    ]),
  },
) {}

const pageSchema = Schema.Struct({
  data: Schema.Struct({
    after: Schema.optional(Schema.NullOr(Schema.String)),
    sponsorships: Schema.Array(
      Schema.Struct({
        uoHash: Schema.optional(Schema.NullOr(Schema.String)),
        txnHash: Schema.optional(Schema.NullOr(Schema.String)),
        sender: Schema.optional(Schema.NullOr(Schema.String)),
        network: Schema.String,
        status: Schema.String,
        confirmedTotalUsd: Schema.optional(
          Schema.NullOr(Schema.Union([Schema.Number, Schema.String])),
        ),
      }),
    ),
  }),
});

export type GasSponsorshipCost = {
  readonly amountMicroUsd: bigint;
  readonly confirmedTotalUsd: string;
};

export type GetGasSponsorshipCost = (
  receipt: Pick<
    EvmExecutionReceipt,
    "chainId" | "userOperationHash" | "transactionHash" | "sender"
  >,
) => Effect.Effect<Option.Option<GasSponsorshipCost>, SponsorshipCostError>;

export const makeGetGasSponsorshipCost = (
  policyId: Redacted.Redacted<string>,
  accessToken: Option.Option<Redacted.Redacted<string>>,
  httpClient: HttpClient.HttpClient,
): GetGasSponsorshipCost =>
  Effect.fn("evm.billing.getGasSponsorshipCost")(
    function* (receipt) {
      if (Option.isNone(accessToken) || Redacted.value(accessToken.value).trim() === "")
        return yield* new SponsorshipCostError({ code: "NOT_CONFIGURED" });
      const chain = getChainDataByCaip2(receipt.chainId);
      if (chain === undefined || chain.environment !== "mainnet")
        return yield* new SponsorshipCostError({ code: "INVALID_RESPONSE" });
      const network = chain.alchemyChain.replaceAll("-", "_").toUpperCase();
      const url = `https://manage.g.alchemy.com/api/gasManager/policy/${encodeURIComponent(Redacted.value(policyId))}/sponsorships`;
      let after: string | undefined;
      for (let page = 0; page < 20; page += 1) {
        const request = HttpClientRequest.get(url).pipe(
          HttpClientRequest.bearerToken(accessToken.value),
          HttpClientRequest.setUrlParam("limit", "100"),
        );
        const response = yield* httpClient
          .execute(
            after === undefined ? request : HttpClientRequest.setUrlParam(request, "after", after),
          )
          .pipe(
            Effect.flatMap(
              Effect.fnUntraced(function* (httpResponse) {
                if (httpResponse.status !== 200)
                  return yield* new SponsorshipCostError({ code: "PROVIDER_UNAVAILABLE" });
                return yield* httpResponse.json;
              }),
            ),
            Effect.mapError(() => new SponsorshipCostError({ code: "PROVIDER_UNAVAILABLE" })),
            Effect.flatMap(Schema.decodeUnknownEffect(pageSchema)),
            Effect.mapError((error) =>
              error instanceof SponsorshipCostError
                ? error
                : new SponsorshipCostError({ code: "INVALID_RESPONSE" }),
            ),
            // Do not export HTTP URLs, authorization headers, or raw provider errors.
            Effect.withTracerEnabled(false),
          );
        const match = response.data.sponsorships.find(
          (record) =>
            record.uoHash?.toLowerCase() === receipt.userOperationHash.toLowerCase() &&
            record.txnHash?.toLowerCase() === receipt.transactionHash.toLowerCase() &&
            record.sender?.toLowerCase() === receipt.sender.toLowerCase() &&
            record.network === network &&
            record.status === "MINED",
        );
        if (
          match !== undefined &&
          match.confirmedTotalUsd !== null &&
          match.confirmedTotalUsd !== undefined
        ) {
          const usd = String(match.confirmedTotalUsd);
          if (usd.length > 64 || !/^\d+(?:\.\d+)?(?:[eE][+-]?\d{1,3})?$/.test(usd))
            return yield* new SponsorshipCostError({ code: "INVALID_RESPONSE" });
          const decimal = BigDecimal.fromString(usd);
          if (Option.isNone(decimal) || BigDecimal.isNegative(decimal.value))
            return yield* new SponsorshipCostError({ code: "INVALID_RESPONSE" });
          // Provider totals are authoritative. Do not apply the quote's 8% margin again.
          const microUsd = BigDecimal.ceil(
            BigDecimal.multiply(decimal.value, BigDecimal.fromBigInt(1_000_000n)),
          );
          return Option.some({
            amountMicroUsd: BigDecimal.scale(microUsd, 0).value,
            confirmedTotalUsd: usd,
          });
        }
        const next = response.data.after;
        if (!next) return Option.none();
        if (next === after) return yield* new SponsorshipCostError({ code: "PAGE_LIMIT" });
        after = next;
      }
      return yield* new SponsorshipCostError({ code: "PAGE_LIMIT" });
    },
    Effect.timeout("30 seconds"),
    Effect.mapError((error) =>
      error instanceof SponsorshipCostError
        ? error
        : new SponsorshipCostError({ code: "PROVIDER_UNAVAILABLE" }),
    ),
  );
