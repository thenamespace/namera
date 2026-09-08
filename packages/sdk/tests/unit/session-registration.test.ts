import { DateTime, Schema } from "effect";

import { CreateSessionKeyRequest } from "@namera-ai/protocol/dto";
import { EvmSessionAuthorization } from "@namera-ai/protocol/evm";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";

import { createLocalSessionBindings } from "../../src/signing/session-registration.js";
import { localExecutionFixture } from "../fixtures/local-execution.js";

const fixture = () => {
  const { binding } = localExecutionFixture();
  const signer = privateKeyToAccount(generatePrivateKey());
  const request = Schema.decodeUnknownSync(CreateSessionKeyRequest)({
    namespace: "eip155",
    walletId: binding.walletId,
    metadata: { version: 1, name: "Trading session" },
    signer: { custody: "local", algorithm: "secp256k1", publicKey: signer.publicKey },
    onchain: {
      chains: [binding.chainId],
      validAfter: 0,
      validUntil: 2_000_000_000,
      permissions: [{ type: "native-token-transfer", allowance: "10000000000000001" }],
      allowSignatures: false,
    },
    policies: [],
  });
  const wallet = { id: binding.walletId, address: binding.walletAddress };
  const installation = {
    id: binding.installationId,
    chainId: binding.chainId,
    status: "pending" as const,
    installTransactionHash: null,
    uninstallTransactionHash: null,
    authorization: Schema.decodeUnknownSync(EvmSessionAuthorization)({
      version: 1,
      entityId: 7,
      signerAddress: signer.address,
      ...Schema.encodeSync(CreateSessionKeyRequest)(request).onchain,
    }),
  };
  return {
    request,
    wallet,
    registration: {
      id: binding.sessionKeyId,
      walletId: wallet.id,
      signingKeyId: binding.signingKeyId,
      wallet,
      installations: [installation] as const,
    },
  };
};

describe("session registration bindings", () => {
  it("derives root and execution-hook flags from the reviewed permission types", () => {
    const input = fixture();
    const installation = input.registration.installations[0];
    for (const [permissions, isGlobal, hasExecutionHooks] of [
      [[{ type: "root" }], true, false],
      [
        [
          { type: "contract-access", address: input.wallet.address },
          { type: "gas-limit", limit: 100n },
        ],
        false,
        false,
      ],
      [
        [{ type: "erc20-token-transfer", address: input.wallet.address, allowance: 100n }],
        false,
        true,
      ],
    ] as const) {
      const [binding] = createLocalSessionBindings({
        ...input,
        request: { ...input.request, onchain: { ...input.request.onchain, permissions } },
        registration: {
          ...input.registration,
          installations: [
            {
              ...installation,
              authorization: { ...installation.authorization, permissions },
            },
          ],
        },
      });
      expect(binding).toMatchObject({ isGlobal, hasExecutionHooks });
    }
  });

  it("binds the requested authority without representing pending registration as activation", () => {
    const input = fixture();
    const [binding] = createLocalSessionBindings(input);
    expect(binding).toMatchObject({
      walletId: input.wallet.id,
      walletAddress: input.wallet.address,
      hasExecutionHooks: true,
      isGlobal: false,
      allowSignatures: false,
    });
    expect(binding?.validUntil).toEqual(DateTime.makeUnsafe(2_000_000_000_000));
  });

  it("rejects changes to expiry, signatures, spend and signer", () => {
    const input = fixture();
    const installation = input.registration.installations[0];
    for (const changes of [
      { validUntil: installation.authorization.validUntil + 1 },
      { allowSignatures: true },
      { permissions: [{ type: "root" as const }] },
      { permissions: [{ type: "native-token-transfer" as const, allowance: 10000000000000002n }] },
      { signerAddress: input.wallet.address },
    ]) {
      expect(() =>
        createLocalSessionBindings({
          ...input,
          registration: {
            ...input.registration,
            installations: [
              {
                ...installation,
                authorization: { ...installation.authorization, ...changes },
              },
            ],
          },
        }),
      ).toThrow();
    }
  });

  it("rejects missing, repeated and substituted chain installations", () => {
    const input = fixture();
    const installation = input.registration.installations[0];
    for (const installations of [[], [installation, installation]]) {
      expect(() =>
        createLocalSessionBindings({
          ...input,
          registration: { ...input.registration, installations },
        }),
      ).toThrow();
    }
    expect(() =>
      createLocalSessionBindings({
        ...input,
        request: {
          ...input.request,
          onchain: { ...input.request.onchain, chains: ["eip155:8453"] },
        },
      }),
    ).toThrow();
  });

  it("rejects a wallet address changed in the registration response", () => {
    const input = fixture();
    expect(() =>
      createLocalSessionBindings({
        ...input,
        registration: {
          ...input.registration,
          wallet: {
            ...input.wallet,
            address: input.registration.installations[0].authorization.signerAddress,
          },
        },
      }),
    ).toThrow();
  });
});
