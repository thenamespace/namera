import { expect, it } from "@effect/vitest";
import { DateTime, Effect, Schema } from "effect";

import { EthereumAddress, EvmPreparedExecution, Hex } from "@namera-ai/protocol";
import type { EvmExecutionSponsorship, SupportedEvmChainId } from "@namera-ai/protocol";
import { createPublicClient, custom } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { createWalletKeySecp256k1Account } from "../../src/accounts/secp256k1.js";
import type { ExecutionClients } from "../../src/clients/execution.js";
import { makePrepareEvmExecution } from "../../src/execution/prepare.js";

const cases: ReadonlyArray<{
  readonly name: string;
  readonly chainId: SupportedEvmChainId;
  readonly sponsorship: EvmExecutionSponsorship;
}> = [
  { name: "sponsored Base", chainId: "eip155:8453", sponsorship: "alchemy-bso" },
  { name: "sponsored Ethereum", chainId: "eip155:1", sponsorship: "alchemy-bso" },
  { name: "sponsored Sepolia", chainId: "eip155:11155111", sponsorship: "alchemy-bso" },
  { name: "self-funded Base", chainId: "eip155:8453", sponsorship: "none" },
];

for (const scenario of cases) {
  it.effect(`prepares and round trips billing for ${scenario.name}`, () =>
    Effect.gen(function* () {
      const owner = privateKeyToAccount(generatePrivateKey());
      const address = EthereumAddress.make(owner.address);
      let quoteRequests = 0;
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
              results: [{ status: "success", data: "0x", gasUsed: 100n }],
              assetChanges: [],
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
        () => {
          quoteRequests += 1;
          return Effect.succeed({
            provider: "alchemy",
            currency: "usd",
            nativeAsset: "ETH",
            nativePriceMicroUsd: 3_000_000_000n,
            surchargeBasisPoints: 800,
            quotedAt: DateTime.fromEpochSeconds(0),
          });
        },
      );
      const prepared = yield* prepare({
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
      const encoded = yield* Schema.encodeEffect(EvmPreparedExecution)(prepared);
      const decoded = yield* Schema.decodeUnknownEffect(EvmPreparedExecution)(encoded);
      expect(decoded.billing).toEqual(prepared.billing);
      const sponsoredMainnet =
        scenario.chainId !== "eip155:11155111" && scenario.sponsorship === "alchemy-bso";
      expect(quoteRequests).toBe(sponsoredMainnet ? 1 : 0);
      if (sponsoredMainnet) {
        expect(prepared.billing.sponsorship?.reservationAmountMicroUsd).toBe(810_000n);
        expect(encoded.billing.sponsorship).toMatchObject({
          reservationAmountMicroUsd: "810000",
          quote: {
            nativePriceMicroUsd: "3000000000",
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
    }),
  );
}
