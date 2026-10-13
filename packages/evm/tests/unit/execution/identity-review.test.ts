import { DateTime } from "effect";
import * as Base64Url from "effect/encoding/Base64Url";

import { EthereumAddress, Hex, WalletOperationId } from "@namera-ai/protocol";
import type { PrepareIdentityPrimaryResponse } from "@namera-ai/protocol/dto";
import { createPublicClient, custom, encodeAbiParameters, hashMessage, hexToBytes } from "viem";
import { entryPoint07Address, getUserOperationHash } from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";

import { makeFactoryEcdsaAccount } from "../../../src/accounts/factory-ecdsa.js";
import { createSecp256k1OwnerAccount } from "../../../src/accounts/secp256k1.js";
import {
  reviewPrimaryName,
  validatePrimaryApproval,
  type ReviewedPrimaryName,
} from "../../../src/identity/review.js";
import { preparedExecutionFixture } from "../../fixtures/prepared-execution.js";

const address = EthereumAddress.make("0x1111111111111111111111111111111111111111");
const registrar = EthereumAddress.make("0x2222222222222222222222222222222222222222");
const now = DateTime.fromEpochSeconds(0);
function fixture() {
  const call = { to: registrar, value: 0n, data: Hex.make("0x1234") };
  const base = preparedExecutionFixture(
    {
      sender: address,
      nonce: 1n << 64n,
      callData: Hex.make("0xabcd"),
      signature: Hex.make("0x"),
      callGasLimit: 10n,
      verificationGasLimit: 10n,
      preVerificationGas: 10n,
      maxFeePerGas: 2n,
      maxPriorityFeePerGas: 1n,
    },
    [call],
  );
  const response: PrepareIdentityPrimaryResponse = {
    operationId: WalletOperationId.make("00000000-0000-7000-8000-000000000001"),
    approval: "1claw",
    options: null,
    prepared: {
      ...base,
      chainId: "eip155:1",
      context: { ...base.context, chainId: "eip155:1" },
      billing: { executionMeter: "execution.mainnet", sponsorship: null },
    },
    expiresAt: DateTime.fromEpochSeconds(60),
  };
  const review: ReviewedPrimaryName = {
    address,
    call,
    callData: "0xabcd",
    entityId: 0,
    factory: registrar,
    factoryData: "0x5678",
    owner: undefined,
    approval: "1claw",
  };
  return { review, response };
}
describe("independent primary-name approval review", () => {
  it("reconstructs managed accounts with only their public owner address", async () => {
    const client = createPublicClient({
      chain: mainnet,
      transport: custom({
        request: async ({ method, params }) => {
          if (method === "eth_getCode") return "0x";
          if (method === "eth_call")
            return encodeAbiParameters(
              [{ type: "address" }],
              [
                params[0].to.toLowerCase() === "0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e"
                  ? registrar
                  : address,
              ],
            );
          throw new Error(`Unexpected RPC method: ${method}`);
        },
      }),
    });
    const owner = privateKeyToAccount(`0x${"01".repeat(32)}`);
    const backendAccount = await makeFactoryEcdsaAccount(
      {
        accountMode: "factory",
        salt: 0n,
        entryPointVersion: "0.7",
        owner: {
          validatorType: "ecdsa_secp256k1",
          account: createSecp256k1OwnerAccount({
            publicKey: owner.publicKey,
            sign: async () => {
              throw new Error("Review must not sign");
            },
          }),
        },
      },
      client,
    );
    const reviewed = await reviewPrimaryName(
      {
        name: "treasury.namera.id",
        wallet: {
          version: 1,
          implementation: "alchemy-modular-v2",
          modularAccountVersion: "2.0.0",
          validatorType: "ecdsa_secp256k1",
          accountMode: "factory",
          factoryVersion: "2.0.0",
          implementationVersion: "v1.0.0",
          ownerAddress: EthereumAddress.make(owner.address),
          address: EthereumAddress.make(backendAccount.address),
          salt: 0n,
          entryPointVersion: "0.7",
        },
      },
      client,
    );
    expect(reviewed.approval).toBe("1claw");
    expect(reviewed.address).toBe(backendAccount.address);
    expect(reviewed.call.to.toLowerCase()).toBe(registrar);
    expect(reviewed.callData).not.toBe(reviewed.call.data);
    expect(reviewed.factoryData?.length).toBeGreaterThan(10);
  });
  it("accepts only the reviewed account, call and fee ceiling", () => {
    const { review, response } = fixture();
    expect(validatePrimaryApproval(review, response, 60n, now)).toMatch(/^0x/);
    expect(() => validatePrimaryApproval(review, response, 59n, now)).toThrow();
    expect(() => validatePrimaryApproval(review, response, 60n, response.expiresAt)).toThrow();
    for (const patch of [
      { sender: registrar },
      { callData: Hex.make("0x1234") },
      { nonce: 0n },
      { factory: registrar, factoryData: Hex.make("0x00") },
      { paymaster: registrar },
    ])
      expect(() =>
        validatePrimaryApproval(
          review,
          {
            ...response,
            prepared: {
              ...response.prepared,
              userOperation: { ...response.prepared.userOperation, ...patch },
            },
          },
          60n,
          now,
        ),
      ).toThrow();
    expect(() =>
      validatePrimaryApproval(
        review,
        {
          ...response,
          prepared: {
            ...response.prepared,
            context: {
              ...response.prepared.context,
              calls: [{ ...review.call, to: registrar, value: 1n }],
            },
          },
        },
        60n,
        now,
      ),
    ).toThrow();
    expect(() =>
      validatePrimaryApproval(
        review,
        { ...response, prepared: { ...response.prepared, chainId: "eip155:8453" } },
        60n,
        now,
      ),
    ).toThrow();
  });
  it("binds the passkey challenge, credential and relying party to the exact envelope", () => {
    const { review, response } = fixture();
    const owner = {
      publicKey: Hex.make("0x04"),
      credentialId: "credential",
      rpId: "dashboard.test",
    };
    const hash = getUserOperationHash({
      userOperation: response.prepared.userOperation,
      chainId: 1,
      entryPointAddress: entryPoint07Address,
      entryPointVersion: "0.7",
    });
    const options = {
      challenge: Base64Url.encode(hexToBytes(hashMessage({ raw: hash }))),
      rpId: owner.rpId,
      userVerification: "required" as const,
      allowCredentials: [{ id: owner.credentialId, type: "public-key" as const }],
      timeout: 60_000,
    };
    const passkey = { ...response, approval: "passkey" as const, options };
    const expected = { ...review, approval: "passkey", owner };
    expect(validatePrimaryApproval(expected, passkey, 60n, now)).toBe(hash);
    for (const patch of [{ challenge: "wrong" }, { rpId: "other.test" }, { allowCredentials: [] }])
      expect(() =>
        validatePrimaryApproval(
          expected,
          { ...passkey, options: { ...options, ...patch } },
          60n,
          now,
        ),
      ).toThrow();
  });
});
