import { expect, it } from "@effect/vitest";
import { Effect, Option, Redacted } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";

import { EthereumAddress, TransactionHash, UserOperationHash } from "@namera-ai/protocol";

import { makeGetGasSponsorshipCost } from "../../src/billing/sponsorship.js";

const receipt = {
  chainId: "eip155:42161" as const,
  userOperationHash: UserOperationHash.make(`0x${"11".repeat(32)}`),
  transactionHash: TransactionHash.make(`0x${"22".repeat(32)}`),
  sender: EthereumAddress.make(`0x${"33".repeat(20)}`),
};
const record = {
  network: "ARB_MAINNET",
  status: "MINED",
  uoHash: receipt.userOperationHash,
  txnHash: receipt.transactionHash,
  sender: receipt.sender,
  confirmedTotalUsd: 0.0096432,
};
const makeLookup = (pages: ReadonlyArray<unknown>, status = 200) => {
  const requests: Array<Parameters<Parameters<typeof HttpClient.make>[0]>[0]> = [];
  const client = HttpClient.make((request) => {
    requests.push(request);
    return Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(JSON.stringify(pages[Math.min(requests.length - 1, pages.length - 1)]), {
          status,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
  });
  return {
    requests,
    client,
    lookup: makeGetGasSponsorshipCost(
      Redacted.make("test-policy"),
      Option.some(Redacted.make("test-token")),
      client,
    ),
  };
};
const page = (sponsorships: ReadonlyArray<unknown>, after: string | null = null) => ({
  data: { sponsorships, after },
});

it.effect("paginates and uses the exact provider total, rounded up without another surcharge", () =>
  Effect.gen(function* () {
    const { lookup, requests } = makeLookup([page([], "next-page"), page([record])]);
    expect(yield* lookup(receipt)).toEqual(
      Option.some({ amountMicroUsd: 9644n, confirmedTotalUsd: "0.0096432" }),
    );
    expect(requests).toHaveLength(2);
    expect(requests[1]?.urlParams).toContainEqual(["after", "next-page"]);
    expect(requests[0]?.headers.authorization).toBe("Bearer test-token");
  }),
);

for (const [label, change] of [
  ["pending", { status: "PENDING" }],
  ["wrong chain", { network: "BASE_MAINNET" }],
  ["wrong operation", { uoHash: `0x${"44".repeat(32)}` }],
  ["wrong transaction", { txnHash: `0x${"44".repeat(32)}` }],
  ["wrong sender", { sender: `0x${"44".repeat(20)}` }],
  ["missing cost", { confirmedTotalUsd: null }],
] as const) {
  it.effect(`does not settle ${label} evidence`, () =>
    Effect.gen(function* () {
      expect(yield* makeLookup([page([{ ...record, ...change }])]).lookup(receipt)).toEqual(
        Option.none(),
      );
    }),
  );
}
for (const [usd, amount] of [
  [0, 0n],
  [1e-7, 1n],
  ["0.000001", 1n],
  ["0.0096432", 9644n],
] as const) {
  it.effect(`converts ${usd} to ${amount} micro USD`, () =>
    Effect.gen(function* () {
      expect(
        yield* makeLookup([page([{ ...record, confirmedTotalUsd: usd }])]).lookup(receipt),
      ).toEqual(Option.some({ amountMicroUsd: amount, confirmedTotalUsd: String(usd) }));
    }),
  );
}
for (const usd of [-1, "NaN", "1e1000000", "not-a-price"]) {
  it.effect(`rejects invalid cost ${usd}`, () =>
    Effect.gen(function* () {
      expect(
        yield* makeLookup([page([{ ...record, confirmedTotalUsd: usd }])])
          .lookup(receipt)
          .pipe(Effect.flip),
      ).toMatchObject({ code: "INVALID_RESPONSE" });
    }),
  );
}
it.effect("fails closed for unavailable credentials, HTTP errors and malformed responses", () =>
  Effect.gen(function* () {
    const { client, requests } = makeLookup([]);
    const noToken = makeGetGasSponsorshipCost(Redacted.make("test-policy"), Option.none(), client);
    expect(yield* noToken(receipt).pipe(Effect.flip)).toMatchObject({ code: "NOT_CONFIGURED" });
    expect(requests).toHaveLength(0);
    expect(yield* makeLookup([{}], 429).lookup(receipt).pipe(Effect.flip)).toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
    expect(yield* makeLookup([{}]).lookup(receipt).pipe(Effect.flip)).toMatchObject({
      code: "INVALID_RESPONSE",
    });
  }),
);
it.effect("bounds repeated provider cursors", () =>
  Effect.gen(function* () {
    const { lookup, requests } = makeLookup([page([], "same-cursor")]);
    expect(yield* lookup(receipt).pipe(Effect.flip)).toMatchObject({ code: "PAGE_LIMIT" });
    expect(requests).toHaveLength(2);
  }),
);

it.effect("bounds scans without mistaking an unvisited record for zero cost", () =>
  Effect.gen(function* () {
    const { lookup, requests } = makeLookup(
      Array.from({ length: 20 }, (_, index) => page([], `page-${index}`)),
    );
    expect(yield* lookup(receipt).pipe(Effect.flip)).toMatchObject({ code: "PAGE_LIMIT" });
    expect(requests).toHaveLength(20);
  }),
);
