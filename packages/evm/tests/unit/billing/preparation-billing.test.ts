import { expect, it } from "@effect/vitest";
import { Effect, Redacted, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";

import { EthereumAddress, EvmPreparedExecution, Hex } from "@namera-ai/protocol";
import type { EvmExecutionSponsorship, SupportedEvmChainId } from "@namera-ai/protocol";
import {
  createPublicClient,
  custom,
  encodeAbiParameters,
  parseAbiParameters,
  toEventSelector,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { createWalletKeySecp256k1Account } from "../../../src/accounts/secp256k1.js";
import { makeEvmGasPrice } from "../../../src/billing/pricing.js";
import type { ExecutionClients } from "../../../src/clients/execution.js";
import { makePrepareEvmExecution } from "../../../src/execution/prepare.js";

const cases: ReadonlyArray<{
  readonly name: string;
  readonly chainId: SupportedEvmChainId;
  readonly sponsorship: EvmExecutionSponsorship;
  readonly invalidPrice?: boolean;
}> = [
  { name: "sponsored Arc", chainId: "eip155:5042", sponsorship: "alchemy-bso" },
  { name: "sponsored Arc Testnet", chainId: "eip155:5042002", sponsorship: "alchemy-bso" },
  { name: "self-funded Arc", chainId: "eip155:5042", sponsorship: "none" },
  { name: "sponsored Base", chainId: "eip155:8453", sponsorship: "alchemy-bso" },
  { name: "sponsored Ethereum", chainId: "eip155:1", sponsorship: "alchemy-bso" },
  { name: "sponsored Sepolia", chainId: "eip155:11155111", sponsorship: "alchemy-bso" },
  { name: "self-funded Base", chainId: "eip155:8453", sponsorship: "none" },
  {
    name: "sponsored Base with invalid price",
    chainId: "eip155:8453",
    sponsorship: "alchemy-bso",
    invalidPrice: true,
  },
  {
    name: "testnet with unavailable pricing",
    chainId: "eip155:11155111",
    sponsorship: "alchemy-bso",
    invalidPrice: true,
  },
  {
    name: "self-funded with unavailable pricing",
    chainId: "eip155:1",
    sponsorship: "none",
    invalidPrice: true,
  },
];

for (const scenario of cases) {
  it.effect(`prepares and round trips billing for ${scenario.name}`, () =>
    Effect.gen(function* () {
      const arc = scenario.chainId === "eip155:5042" || scenario.chainId === "eip155:5042002";
      const owner = privateKeyToAccount(generatePrivateKey());
      const address = EthereumAddress.make(owner.address);
      let quoteRequests = 0;
      const getGasPrice = makeEvmGasPrice(
        { alchemyApiKey: Redacted.make("test"), alchemyBsoPolicyId: Redacted.make("test") },
        HttpClient.make((request) =>
          Effect.succeed(
            HttpClientResponse.fromWeb(
              request,
              new Response(
                JSON.stringify({
                  data: [
                    {
                      symbol: arc ? "USDC" : "ETH",
                      prices: [
                        {
                          currency: "usd",
                          value: scenario.invalidPrice ? "0" : arc ? "1" : "3000",
                          lastUpdatedAt: "1970-01-01T00:00:00.000Z",
                        },
                      ],
                    },
                  ],
                }),
              ),
            ),
          ),
        ),
      );
      const prepare = makePrepareEvmExecution(
        (chain) => {
          const publicClient = createPublicClient({
            chain: chain.chain,
            transport: custom({
              request: async () => {
                throw new Error("Unexpected live RPC request");
              },
            }),
          }).extend(() => ({
            simulateCalls: async () => ({
              block: { hash: `0x${"ab".repeat(32)}`, number: 1n, timestamp: 1n },
              results: [
                {
                  status: "success",
                  data: "0x",
                  gasUsed: 100n,
                  logs: arc
                    ? [
                        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                        "0xfffffffffffffffffffffffffffffffffffffffe",
                      ].map((emitter) => ({
                        address: emitter,
                        data: encodeAbiParameters(parseAbiParameters("uint256"), [10n ** 18n]),
                        topics: [
                          toEventSelector("Transfer(address,address,uint256)"),
                          `0x${"00".repeat(12)}${address.slice(2)}`,
                          `0x${"00".repeat(12)}${address.slice(2)}`,
                        ],
                      }))
                    : [],
                },
              ],
              assetChanges: arc
                ? [
                    {
                      token: {
                        address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                        symbol: "ETH",
                        decimals: 18,
                      },
                      value: { pre: 2n * 10n ** 18n, post: 10n ** 18n, diff: -(10n ** 18n) },
                    },
                    {
                      token: {
                        address: "0x3600000000000000000000000000000000000000",
                        symbol: "USDC",
                        decimals: 6,
                      },
                      value: { pre: 2_000_000n, post: 1_000_000n, diff: -1_000_000n },
                    },
                  ]
                : [],
            }),
          }));
          // Substitute only the provider responses; preparation and account reconstruction are real.
          return {
            publicClient,
            createSmartAccountClient: () => ({
              prepareUserOperation: async () => ({
                sender: address,
                nonce: 0n,
                callData: "0x",
                signature: "0x",
                callGasLimit: 100_000n,
                verificationGasLimit: 100_000n,
                preVerificationGas: 50_000n,
                maxFeePerGas: 1_000_000_000n,
                maxPriorityFeePerGas: 100_000_000n,
              }),
            }),
          } as unknown as ExecutionClients;
        },
        (chain) => {
          quoteRequests += 1;
          return getGasPrice(chain);
        },
      );
      const preparation = prepare({
        account: {
          wallet: {
            version: 1,
            implementation: "alchemy-modular-v2",
            modularAccountVersion: "2.0.0",
            entryPointVersion: "0.7",
            validatorType: "ecdsa_secp256k1",
            accountMode: "7702",
            delegationVersion: "v1.0.0",
            address,
          },
          owner: {
            validatorType: "ecdsa_secp256k1",
            account: createWalletKeySecp256k1Account({
              publicKey: owner.publicKey,
              sign: async () => {
                throw new Error("Preparation must not sign");
              },
            }),
          },
        },
        chainId: scenario.chainId,
        sponsorship: scenario.sponsorship,
        calls: [{ to: address, value: 0n, data: Hex.make("0x") }],
      });
      if (scenario.invalidPrice && scenario.chainId === "eip155:8453") {
        expect(yield* preparation.pipe(Effect.flip)).toMatchObject({ code: "PREPARATION_FAILED" });
        expect(quoteRequests).toBe(1);
        return;
      }
      const prepared = yield* preparation;
      if (arc) {
        expect(prepared.context.simulation.calls.assetChanges).toHaveLength(1);
        expect(prepared.context.simulation.calls.assetChanges[0]?.asset).toMatchObject({
          symbol: "USDC",
          decimals: 18,
        });
        expect(prepared.context.simulation.calls.transfers).toHaveLength(1);
        expect(prepared.context.simulation.calls.transfers[0]?.value).toBe(10n ** 18n);
      }
      const encoded = yield* Schema.encodeEffect(EvmPreparedExecution)(prepared);
      const decoded = yield* Schema.decodeUnknownEffect(EvmPreparedExecution)(encoded);
      expect(decoded.billing).toEqual(prepared.billing);
      const sponsoredMainnet =
        !(["eip155:11155111", "eip155:5042002"] as string[]).includes(scenario.chainId) &&
        scenario.sponsorship === "alchemy-bso";
      expect(quoteRequests).toBe(sponsoredMainnet ? 1 : 0);
      if (sponsoredMainnet) {
        expect(prepared.billing.sponsorship?.reservationAmountMicroUsd).toBe(arc ? 270n : 810_000n);
        expect(encoded.billing.sponsorship).toMatchObject({
          reservationAmountMicroUsd: arc ? "270" : "810000",
          quote: {
            nativeAsset: arc ? "USDC" : "ETH",
            nativePriceMicroUsd: arc ? "1000000" : "3000000000",
            quotedAt: "1970-01-01T00:00:00.000Z",
          },
        });
      } else {
        expect(prepared.billing.sponsorship).toBeNull();
      }
      expect(prepared.userOperation.maxFeePerGas).toBe(
        scenario.sponsorship === "alchemy-bso" ? 0n : 1_000_000_000n,
      );
      expect(prepared.context.simulation.userOperation.maxFeePerGas).toBe(1_000_000_000n);
      const estimate = prepared.context.simulation.userOperation;
      expect(
        (estimate.callGasLimit + estimate.verificationGasLimit + estimate.preVerificationGas) *
          estimate.maxFeePerGas,
      ).toBe(250_000_000_000_000n);
    }),
  );
}
