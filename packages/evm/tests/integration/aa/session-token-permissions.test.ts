import { Effect, Schema } from "effect";

import { toModularAccountV2Base } from "@alchemy/smart-accounts";
import { EvmSessionAuthorization } from "@namera-ai/protocol/evm";
import { concatHex, encodeAbiParameters, encodeFunctionData, erc20Abi, parseEventLogs } from "viem";
import type { TransactionReceipt } from "viem";
import { entryPoint07Abi } from "viem/account-abstraction";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";

import { getChainDataByCaip2 } from "../../../src/chains/helpers.js";
import { reconstructExecutionAccount } from "../../../src/execution/account.js";
import { makeEvmSessionService } from "../../../src/sessions/service.js";
import { tokenBytecode } from "./contracts/token-bytecode.js";
import { makeAnvilFixture } from "./fixture.js";

const anvilUrl = process.env.NAMERA_TEST_ANVIL_URL;
const recipient = "0x0000000000000000000000000000000000004567";
const succeeded = (logs: TransactionReceipt["logs"]) =>
  parseEventLogs({ abi: entryPoint07Abi, eventName: "UserOperationEvent", logs })[0]?.args.success;

describe.skipIf(anvilUrl === undefined)("real token session permissions", () => {
  for (const kind of ["selector", "allowance"] as const) {
    it(`enforces ${kind} restrictions on token calls`, async () => {
      if (anvilUrl === undefined) throw new Error("NAMERA_TEST_ANVIL_URL is required");
      const { account, reconstruction, publicClient, submit, deployContract } =
        await makeAnvilFixture(anvilUrl);
      const token = await deployContract(
        concatHex([tokenBytecode, encodeAbiParameters([{ type: "address" }], [account.address])]),
      );
      const key = privateKeyToAccount(generatePrivateKey());
      const now = Number((await publicClient.getBlock()).timestamp);
      const service = makeEvmSessionService(() => ({ publicClient }), {
        prepare: () => Effect.die(new Error("Compilation cannot prepare operations")),
      });
      const compiled = await Effect.runPromise(
        service.compile({
          account: reconstruction,
          chainId: "eip155:11155111",
          authorization: Schema.decodeUnknownSync(EvmSessionAuthorization)({
            version: 1,
            entityId: 1,
            signerAddress: key.address,
            validAfter: now - 60,
            validUntil: now + 3600,
            permissions:
              kind === "selector"
                ? [{ type: "functions-on-contract", address: token, functions: ["0xa9059cbb"] }]
                : [{ type: "erc20-token-transfer", address: token, allowance: "10" }],
          }),
        }),
      );
      const installation = await submit(
        account,
        await account.encodeCalls([{ to: account.address, data: compiled.installCallData }]),
      );
      expect(succeeded(installation.logs)).toBe(true);
      const chain = getChainDataByCaip2("eip155:11155111");
      if (chain === undefined) throw new Error("Missing fixture chain");
      const session = await Effect.runPromise(
        reconstructExecutionAccount(
          { account: reconstruction, session: compiled },
          chain,
          publicClient,
        ),
      );
      // The client signs the UserOperation with the installed local EOA entity.
      const signer = await toModularAccountV2Base({
        client: publicClient,
        owner: key,
        accountAddress: session.address,
        signerEntity: { entityId: 1, isGlobalValidation: false },
        getFactoryArgs: async () => ({}),
      });
      const call = async (functionName: "transfer" | "approve", amount: bigint) =>
        submit(
          signer,
          await signer.encodeCalls([
            {
              to: token,
              data: encodeFunctionData({ abi: erc20Abi, functionName, args: [recipient, amount] }),
            },
          ]),
        );
      expect(succeeded((await call("transfer", 6n)).logs)).toBe(true);
      if (kind === "selector") {
        await expect(call("approve", 1n)).rejects.toThrow();
        expect(
          await publicClient.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "allowance",
            args: [account.address, recipient],
          }),
        ).toBe(0n);
      } else {
        expect(succeeded((await call("approve", 4n)).logs)).toBe(true);
        expect(succeeded((await call("transfer", 1n)).logs)).toBe(false);
        expect(succeeded((await call("approve", 5n)).logs)).toBe(false);
        expect(
          await publicClient.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "allowance",
            args: [account.address, recipient],
          }),
        ).toBe(4n);
      }
      expect(
        await publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [recipient],
        }),
      ).toBe(6n);
      expect(
        await publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [account.address],
        }),
      ).toBe(994n);
    }, 60_000);
  }
});
