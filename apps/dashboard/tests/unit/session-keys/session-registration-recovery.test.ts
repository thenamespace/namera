import { Schema } from "effect";

import { EthereumAddress, SessionKeyId, SigningKeyId, WalletId } from "@namera-ai/protocol";
import { CreateSessionKeyRequest, SessionKeyInstallationResponse } from "@namera-ai/protocol/dto";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { expect, it } from "vitest";

import { recoverSessionRegistration } from "../../../src/components/session-key-installations/registration-recovery";
import { validateManagedRegistration } from "../../../src/routes/_authenticated/session-keys/-components/create-session-key-form/managed-registration";

const signer = privateKeyToAccount(generatePrivateKey());
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
    chains: ["eip155:1"],
    validAfter: 0,
    validUntil: 2_000_000_000,
    permissions: [{ type: "root" }],
    allowSignatures: false,
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
  const other = privateKeyToAccount(generatePrivateKey());
  expect(
    recoverSessionRegistration(
      {
        ...request,
        signer: { custody: "local", algorithm: "secp256k1", publicKey: other.publicKey },
      },
      wallet,
      [registration],
    ),
  ).toBeUndefined();
});

it("rejects ambiguous, revoked or changed registrations before export", () => {
  expect(() => recoverSessionRegistration(request, wallet, [registration, registration])).toThrow();
  expect(() =>
    recoverSessionRegistration(request, wallet, [{ ...registration, status: "revoked" }]),
  ).toThrow();
  expect(() =>
    recoverSessionRegistration(
      { ...request, onchain: { ...request.onchain, allowSignatures: true } },
      wallet,
      [registration],
    ),
  ).toThrow();
  expect(() =>
    recoverSessionRegistration(
      {
        ...request,
        policies: [{ type: "evm.signature", version: 1, allowedTypes: ["message", "typed-data"] }],
      },
      wallet,
      [registration],
    ),
  ).toThrow();
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
  ).toThrow();
  expect(() =>
    validateManagedRegistration(managed, wallet, {
      ...created,
      signer: { ...created.signer, publicKey: privateKeyToAccount(generatePrivateKey()).publicKey },
    }),
  ).toThrow();
  expect(() =>
    validateManagedRegistration(
      { ...managed, onchain: { ...managed.onchain, allowSignatures: true } },
      wallet,
      created,
    ),
  ).toThrow();
});
