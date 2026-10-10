import * as Base64Url from "effect/encoding/Base64Url";

import { SessionKeyOperationId } from "@namera-ai/protocol";
import type { PrepareSessionKeyOperationResponse } from "@namera-ai/protocol/dto";
import { Hex } from "@namera-ai/protocol/evm";
import { hashMessage, hexToBytes } from "viem";
import { getUserOperationHash } from "viem/account-abstraction";
import { describe, expect, it } from "vitest";

import {
  validateOwnerApproval,
  validateManagedOwnerApproval,
  type ReviewedOwnerOperation,
} from "../../../src/signing/owner-approval.js";
import { localExecutionFixture } from "../../fixtures/local-execution.js";

const fixture = () => {
  const execution = localExecutionFixture();
  const reviewed: ReviewedOwnerOperation = {
    chainId: execution.binding.chainId,
    walletAddress: execution.binding.walletAddress,
    ownerEntityId: 0,
    callData: "0x12345678",
    factory: execution.binding.signerAddress,
    factoryData: "0x87654321",
    credentialId: "dGVzdA",
    rpId: "localhost",
    sponsor: true,
  };
  const prepared = {
    ...execution.response.prepared,
    userOperation: {
      ...execution.response.prepared.userOperation,
      nonce: 1n << 64n,
      callData: Hex.make(reviewed.callData),
    },
    context: {
      ...execution.response.prepared.context,
      calls: [
        { to: execution.binding.walletAddress, value: 0n, data: Hex.make(reviewed.callData) },
      ],
    },
  };
  const hash = getUserOperationHash({
    userOperation: prepared.userOperation,
    chainId: 11155111,
    entryPointAddress: prepared.entryPoint,
    entryPointVersion: "0.7",
  });
  const response: PrepareSessionKeyOperationResponse = {
    namespace: "eip155",
    operationId: SessionKeyOperationId.make("01950000-0000-7000-8000-000000000006"),
    prepared,
    expiresAt: execution.response.expiresAt,
    options: {
      challenge: Base64Url.encode(hexToBytes(hashMessage({ raw: hash }))),
      rpId: reviewed.rpId,
      timeout: 60000,
      userVerification: "required",
      allowCredentials: [{ id: reviewed.credentialId, type: "public-key" }],
    },
  };
  return { reviewed, response, now: execution.now, hash };
};

describe("owner approval validation", () => {
  it("validates managed approval without a WebAuthn challenge and rejects altered authority", () => {
    const original = fixture();
    const { options: _options, ...prepared } = original.response;
    const input = { ...original, response: { ...prepared, approval: "1claw" as const } };
    expect(validateManagedOwnerApproval(input)).toBe(original.hash);
    expect(() => validateManagedOwnerApproval({ ...input, now: input.response.expiresAt })).toThrow(
      expect.objectContaining({ reason: "expiry" }),
    );
    expect(() =>
      validateManagedOwnerApproval({
        ...input,
        reviewed: { ...input.reviewed, chainId: "eip155:1" },
      }),
    ).toThrow(expect.objectContaining({ reason: "identity" }));
    for (const change of [
      { callData: Hex.make("0xdeadbeef") },
      { nonce: 7n << 72n },
      { factoryData: Hex.make("0xdeadbeef") },
      { maxFeePerGas: 1n },
    ]) {
      expect(() =>
        validateManagedOwnerApproval({
          ...input,
          response: {
            ...input.response,
            prepared: {
              ...input.response.prepared,
              userOperation: { ...input.response.prepared.userOperation, ...change },
            },
          },
        }),
      ).toThrow();
    }
  });
  it("binds the passkey challenge to the locally reviewed owner operation", () => {
    const input = fixture();
    expect(validateOwnerApproval(input)).toBe(input.hash);
  });

  it("rejects substituted self calls, owner validators, chains and factory data", () => {
    const input = fixture();
    for (const userOperation of [
      { ...input.response.prepared.userOperation, callData: Hex.make("0xdeadbeef") },
      { ...input.response.prepared.userOperation, nonce: 7n << 72n },
      { ...input.response.prepared.userOperation, factoryData: Hex.make("0xdeadbeef") },
    ]) {
      expect(() =>
        validateOwnerApproval({
          ...input,
          response: {
            ...input.response,
            prepared: { ...input.response.prepared, userOperation },
          },
        }),
      ).toThrow();
    }
    expect(() =>
      validateOwnerApproval({
        ...input,
        reviewed: {
          ...input.reviewed,
          chainId: "eip155:1",
        },
      }),
    ).toThrow(expect.objectContaining({ reason: "identity" }));
  });

  it("rejects expired approvals, different credentials and unrelated challenges", () => {
    const input = fixture();
    expect(() => validateOwnerApproval({ ...input, now: input.response.expiresAt })).toThrow(
      expect.objectContaining({ reason: "expiry" }),
    );
    for (const options of [
      { ...input.response.options, challenge: "dGVzdA" },
      { ...input.response.options, rpId: "other.example" },
      { ...input.response.options, allowCredentials: [] },
      {
        ...input.response.options,
        allowCredentials: [{ id: "b3RoZXI", type: "public-key" as const }],
      },
    ]) {
      expect(() =>
        validateOwnerApproval({ ...input, response: { ...input.response, options } }),
      ).toThrow(expect.objectContaining({ reason: "challenge" }));
    }
  });

  it("rejects charging the owner for an explicitly sponsored approval", () => {
    const input = fixture();
    expect(() =>
      validateOwnerApproval({
        ...input,
        response: {
          ...input.response,
          prepared: {
            ...input.response.prepared,
            userOperation: { ...input.response.prepared.userOperation, maxFeePerGas: 1n },
          },
        },
      }),
    ).toThrow(expect.objectContaining({ reason: "gas" }));
  });

  it("accepts exact deployment data and enforces the local self-funded gas ceiling", () => {
    const input = fixture();
    const prepared = {
      ...input.response.prepared,
      sponsorship: "none" as const,
      userOperation: {
        ...input.response.prepared.userOperation,
        factory: input.reviewed.factory as typeof input.response.prepared.userOperation.sender,
        factoryData: Hex.make(input.reviewed.factoryData),
        maxFeePerGas: 1n,
      },
    };
    const hash = getUserOperationHash({
      userOperation: prepared.userOperation,
      chainId: 11155111,
      entryPointAddress: prepared.entryPoint,
      entryPointVersion: "0.7",
    });
    const changed = {
      ...input,
      reviewed: { ...input.reviewed, sponsor: false },
      response: {
        ...input.response,
        prepared,
        options: {
          ...input.response.options,
          challenge: Base64Url.encode(hexToBytes(hashMessage({ raw: hash }))),
        },
      },
    };
    expect(() => validateOwnerApproval(changed)).toThrow(
      expect.objectContaining({ reason: "gas" }),
    );
    expect(() =>
      validateOwnerApproval({
        ...changed,
        reviewed: {
          ...changed.reviewed,
          maxGasCostWei: 299999n,
        },
      }),
    ).toThrow(expect.objectContaining({ reason: "gas" }));
    expect(
      validateOwnerApproval({
        ...changed,
        reviewed: {
          ...changed.reviewed,
          maxGasCostWei: 300000n,
        },
      }),
    ).toBe(hash);
  });
});
