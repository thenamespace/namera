import { BigDecimal, Effect, Redacted, Schema } from "effect";
import { HttpClientRequest, HttpClient } from "effect/http";

import { type EthereumAddress, Hex } from "@namera-ai/protocol";
import type { PortfolioAsset } from "@namera-ai/protocol/dto";
import { formatUnits, toHex } from "viem";

import { arcUsdcAddress } from "../chains/arc.js";
import type { ChainData } from "../chains/data.js";
import type { EvmConfigValues } from "../config.js";
import type { EvmPortfolioSnapshot } from "./types.js";

const balanceResponse = Schema.Struct({
  result: Hex.check(Schema.isPattern(/^0x[0-9a-fA-F]+$/)),
});

export const makeArcNativePortfolio = (
  config: EvmConfigValues,
  httpClient: HttpClient.HttpClient,
) =>
  Effect.fnUntraced(function* (
    address: EthereumAddress,
    chain: ChainData,
    portfolio: EvmPortfolioSnapshot,
  ): Effect.fn.Return<EvmPortfolioSnapshot> {
    const native = portfolio.items.find((asset) => asset.type === "native");
    const erc20 = portfolio.items.find(
      (asset) => asset.tokenAddress?.toLowerCase() === arcUsdcAddress,
    );
    const balance = yield* HttpClient.filterStatusOk(httpClient)
      .execute(
        HttpClientRequest.post(
          `https://${chain.alchemyChain}.g.alchemy.com/v2/${encodeURIComponent(Redacted.value(config.alchemyApiKey))}`,
        ).pipe(
          HttpClientRequest.bodyJsonUnsafe({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getBalance",
            params: [address, "latest"],
          }),
        ),
      )
      .pipe(
        Effect.flatMap((response) => response.json),
        Effect.flatMap(Schema.decodeUnknownEffect(balanceResponse)),
        Effect.map(({ result }) => BigInt(result)),
        Effect.timeout("5 seconds"),
        Effect.withTracerEnabled(false),
        Effect.catch(() => Effect.succeed(null)),
      );

    // Native RPC retains dust that is truncated by the six-decimal ERC-20 view.
    // An unavailable indexer still permits showing the known native balance,
    // with a partial failure so callers do not mistake it for the full portfolio.
    const rawBalance = balance ?? (native === undefined ? undefined : BigInt(native.rawBalance));
    if (rawBalance === undefined) {
      return {
        items: portfolio.items,
        partialFailures: [{ chainId: chain.chainId, code: "PROVIDER_UNAVAILABLE" }],
      };
    }

    const formattedBalance = formatUnits(rawBalance, 18);
    const usdPrice = native?.usdPrice ?? erc20?.usdPrice ?? null;
    const asset: PortfolioAsset = {
      namespace: "eip155",
      chainId: chain.chainId,
      type: "native",
      tokenAddress: null,
      rawBalance: Hex.make(toHex(rawBalance)),
      formattedBalance,
      metadata: {
        name: "USDC",
        symbol: "USDC",
        decimals: 18,
        logoUrl: native?.metadata.logoUrl ?? erc20?.metadata.logoUrl ?? null,
      },
      usdPrice,
      valueUsd:
        usdPrice === null
          ? null
          : BigDecimal.format(
              BigDecimal.multiply(
                BigDecimal.fromStringUnsafe(formattedBalance),
                BigDecimal.fromStringUnsafe(usdPrice.value),
              ),
            ),
    };

    return {
      items: [
        ...portfolio.items.filter(
          (entry) =>
            entry.type !== "native" && entry.tokenAddress?.toLowerCase() !== arcUsdcAddress,
        ),
        ...(rawBalance === 0n ? [] : [asset]),
      ],
      partialFailures: portfolio.partialFailures,
    };
  });
