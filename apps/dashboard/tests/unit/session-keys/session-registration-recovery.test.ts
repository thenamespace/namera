import { Schema } from "effect";

import { EthereumAddress, SessionKeyId, SigningKeyId, WalletId } from "@namera-ai/protocol";
import { CreateSessionKeyRequest, SessionKeyInstallationResponse } from "@namera-ai/protocol/dto";
import { privateKeyToAccount } from "viem/accounts";
import { expect, it } from "vitest";

import { validateManagedRegistration } from "../../../src/components/session-key-creation/managed-registration";
import { recoverSessionRegistration } from "../../../src/components/session-key-installations/registration-recovery";

// Public deterministic test keys; never used for funded accounts.
const signer = privateKeyToAccount(`0x${"01".repeat(32)}`);
const otherSigner = privateKeyToAccount(`0x${"02".repeat(32)}`);
const wallet = {
  id: WalletId.make("01950000-0000-7000-8000-000000000001"),
  address: EthereumAddress.make(signer.address),
};
const request = Schema.decodeUnknownSync(CreateSessionKeyRequest)({
  namespace: "eip155",
  walletId: wallet.id,
  metadata: { version: 1, name: "Recovery" },
  signer: { custody: "local", algorithm: "secp256k1", publicKey: signer.publicKey },
  onchain: {
    installations: [
      {
        chainId: "eip155:1",
        validAfter: 0,
        validUntil: 2_000_000_000,
        permissions: [{ type: "root" }],
        allowSignatures: false,
      },
    ],
  },
  policies: [],
});
const registration = {
  id: SessionKeyId.make("01950000-0000-7000-8000-000000000002"),
  walletId: wallet.id,
  wallet,
  signingKeyId: SigningKeyId.make("01950000-0000-7000-8000-000000000003"),
  status: "pending" as const,
  policies: [],
  installations: [
    Schema.decodeUnknownSync(SessionKeyInstallationResponse)({
      id: "01950000-0000-7000-8000-000000000004",
      chainId: "eip155:1",
      status: "pending",
      authorization: {
        version: 1,
        entityId: 7,
        signerAddress: signer.address,
        validAfter: 0,
        validUntil: 2_000_000_000,
        permissions: [{ type: "root" }],
        allowSignatures: false,
      },
      installTransactionHash: null,
      uninstallTransactionHash: null,
    }),
  ],
};

it("recovers the original pending signer registration and leaves unknown signers alone", () => {
  expect(recoverSessionRegistration(request, wallet, [registration])).toBe(registration);
  expect(recoverSessionRegistration(request, wallet, [])).toBeUndefined();
  expect(
    recoverSessionRegistration(
      {
        ...request,
        signer: { custody: "local", algorithm: "secp256k1", publicKey: otherSigner.publicKey },
      },
      wallet,
      [registration],
    ),
  ).toBeUndefined();
});

it("rejects ambiguous, revoked or changed registrations before export", () => {
  expect(() => recoverSessionRegistration(request, wallet, [registration, registration])).toThrow(
    "The local signer does not identify one pending registration",
  );
  expect(() =>
    recoverSessionRegistration(request, wallet, [{ ...registration, status: "revoked" }]),
  ).toThrow("The local signer does not identify one pending registration");
  expect(() =>
    recoverSessionRegistration(
      {
        ...request,
        onchain: {
          installations: Array.from(request.onchain.installations, (entry) => ({
            ...entry,
            allowSignatures: true,
          })),
        },
      },
      wallet,
      [registration],
    ),
  ).toThrow(expect.objectContaining({ code: "PERMISSION_MISMATCH" }));
  expect(() =>
    recoverSessionRegistration(
      {
        ...request,
        policies: [{ type: "evm.signature", version: 1, allowedTypes: ["message", "typed-data"] }],
      },
      wallet,
      [registration],
    ),
  ).toThrow("Recovered API policies differ from the original request");
});

it("validates managed public identity and permissions without producing an export", () => {
  const managed = {
    ...request,
    signer: { custody: "namera-managed", provider: "1claw", algorithm: "secp256k1" } as const,
  };
  const created = { ...registration, signer: { ...managed.signer, publicKey: signer.publicKey } };
  expect(validateManagedRegistration(managed, wallet, created)).toBeUndefined();
  expect(() =>
    validateManagedRegistration(managed, wallet, { ...created, status: "active" }),
  ).toThrow("Managed session registration does not match requested custody");
  expect(() =>
    validateManagedRegistration(managed, wallet, {
      ...created,
      signer: { ...created.signer, publicKey: otherSigner.publicKey },
    }),
  ).toThrow(expect.objectContaining({ code: "IDENTITY_MISMATCH" }));
  expect(() =>
    validateManagedRegistration(
      {
        ...managed,
        onchain: {
          installations: Array.from(managed.onchain.installations, (entry) => ({
            ...entry,
            allowSignatures: true,
          })),
        },
      },
      wallet,
      created,
    ),
  ).toThrow(expect.objectContaining({ code: "PERMISSION_MISMATCH" }));
});
