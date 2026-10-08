import { DateTime } from "effect";

import { EXECUTE_USER_OP_SELECTOR } from "@alchemy/smart-accounts";
import { Bytes32, Hex } from "@namera-ai/protocol/evm";
import { concatHex } from "viem";
import { entryPoint07Address, getUserOperationHash } from "viem/account-abstraction";
import { describe, expect, it } from "vitest";

import { validateLocalExecution } from "../../../src/signing/execution-validation.js";
import { localExecutionFixture } from "../../fixtures/local-execution.js";

const rehash = (fixture: ReturnType<typeof localExecutionFixture>) => ({
  ...fixture,
  response: {
    ...fixture.response,
    signing: {
      method: "personal_sign" as const,
      message: Bytes32.make(
        getUserOperationHash({
          userOperation: fixture.response.prepared.userOperation,
          chainId: 11155111,
          entryPointVersion: "0.7",
          entryPointAddress: entryPoint07Address,
        }),
      ),
    },
  },
});

describe("local execution validation", () => {
  it("recomputes the raw user operation hash from the local chain and canonical EntryPoint", () => {
    const fixture = localExecutionFixture();
    expect(validateLocalExecution(fixture)).toBe(fixture.response.signing.message);
  });

  it("rejects a different session binding even when the server supplies a consistent hash", () => {
    const fixture = localExecutionFixture();
    expect(() =>
      validateLocalExecution({ ...fixture, binding: { ...fixture.binding, entityId: 8 } }),
    ).toThrow(expect.objectContaining({ reason: "validator" }));
  });

  it("rejects changed calls even after the server recomputes their hash", () => {
    const fixture = localExecutionFixture();
    const changed = {
      ...fixture,
      response: {
        ...fixture.response,
        prepared: {
          ...fixture.response.prepared,
          userOperation: {
            ...fixture.response.prepared.userOperation,
            callData: Hex.make("0x12345678"),
          },
        },
      },
    };
    expect(() => validateLocalExecution(rehash(changed))).toThrow(
      expect.objectContaining({ reason: "calls" }),
    );
  });

  it("uses locally known execution hooks, not a server-selected wrapper", () => {
    const fixture = localExecutionFixture();
    const changed = rehash({
      ...fixture,
      response: {
        ...fixture.response,
        prepared: {
          ...fixture.response.prepared,
          userOperation: {
            ...fixture.response.prepared.userOperation,
            callData: Hex.make(
              concatHex([
                EXECUTE_USER_OP_SELECTOR,
                fixture.response.prepared.userOperation.callData,
              ]),
            ),
          },
        },
      },
    });
    expect(() => validateLocalExecution(changed)).toThrow(
      expect.objectContaining({ reason: "calls" }),
    );
    expect(
      validateLocalExecution({
        ...changed,
        binding: { ...changed.binding, hasExecutionHooks: true },
      }),
    ).toBe(changed.response.signing.message);
  });

  it("refuses an expired preparation", () => {
    const fixture = localExecutionFixture();
    expect(() => validateLocalExecution({ ...fixture, now: fixture.response.expiresAt })).toThrow(
      expect.objectContaining({ reason: "expiry" }),
    );
    expect(() =>
      validateLocalExecution({ ...fixture, now: DateTime.makeUnsafe("2026-09-08T10:00:00Z") }),
    ).toThrow(expect.objectContaining({ reason: "expiry" }));
  });

  it("refuses server fees for a sponsored request", () => {
    const fixture = localExecutionFixture();
    const changed = rehash({
      ...fixture,
      response: {
        ...fixture.response,
        prepared: {
          ...fixture.response.prepared,
          userOperation: { ...fixture.response.prepared.userOperation, maxFeePerGas: 1n },
        },
      },
    });
    expect(() => validateLocalExecution(changed)).toThrow(
      expect.objectContaining({ reason: "sponsorship" }),
    );
  });

  it("requires explicit local fee consent for a self-funded operation", () => {
    const fixture = localExecutionFixture();
    const changed = rehash({
      ...fixture,
      request: { ...fixture.request, sponsor: false },
      response: {
        ...fixture.response,
        prepared: {
          ...fixture.response.prepared,
          sponsorship: "none",
          userOperation: { ...fixture.response.prepared.userOperation, maxFeePerGas: 1n },
        },
      },
    });
    expect(() => validateLocalExecution(changed)).toThrow(
      expect.objectContaining({ reason: "gas" }),
    );
    expect(() => validateLocalExecution({ ...changed, maxGasCostWei: 299999n })).toThrow(
      expect.objectContaining({ reason: "gas" }),
    );
    expect(validateLocalExecution({ ...changed, maxGasCostWei: 300000n })).toBe(
      changed.response.signing.message,
    );
  });

  it("rejects an advertised signing hash unrelated to the operation", () => {
    const fixture = localExecutionFixture();
    expect(() =>
      validateLocalExecution({
        ...fixture,
        response: {
          ...fixture.response,
          signing: { method: "personal_sign", message: Bytes32.make(`0x${"00".repeat(32)}`) },
        },
      }),
    ).toThrow(expect.objectContaining({ reason: "hash" }));
  });
});
