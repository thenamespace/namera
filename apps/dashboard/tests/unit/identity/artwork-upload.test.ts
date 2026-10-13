import { DateTime, Schema } from "effect";

import { ownerMessageChallenge } from "@namera-ai/evm/signature-review";
import {
  EthereumAddress,
  Hex,
  SignatureOperationId,
  SigningKeyId,
  WalletId,
} from "@namera-ai/protocol";
import type {
  WalletResponse,
  PrepareWalletSignatureResponse,
  CompleteWalletSignatureResponse,
  GetWalletPasskeyOwnerResponse,
} from "@namera-ai/protocol/dto";
import { describe, expect, it, vi } from "vitest";

import {
  ArtworkSchema,
  artworkLimit,
} from "../../../src/routes/_authenticated/identity/-components/artwork-schema";
import {
  saveArtwork,
  validateArtworkApproval,
  type UploadedArtwork,
} from "../../../src/routes/_authenticated/identity/-components/artwork-upload";

const wallet = {
  id: WalletId.make("01950000-0000-7000-8000-000000000001"),
  address: EthereumAddress.make("0x0000000000000000000000000000000000000001"),
  owner: {
    custody: "namera-managed",
    provider: "1claw",
    algorithm: "secp256k1",
    signingKeyId: SigningKeyId.make("01950000-0000-7000-8000-000000000002"),
  },
  data: { validatorType: "ecdsa_secp256k1", accountMode: "factory" },
} as WalletResponse;
const message = "Authorize this image upload";
const prepared = (): PrepareWalletSignatureResponse => ({
  namespace: "eip155",
  walletId: wallet.id,
  account: wallet.address,
  signingKeyId: wallet.owner.signingKeyId,
  operationId: SignatureOperationId.make("01950000-0000-7000-8000-000000000003"),
  request: { namespace: "eip155", chainId: "eip155:1", type: "message", message },
  signing: { method: "server" },
  expiresAt: DateTime.makeUnsafe(Date.now() + 60_000),
});
const file = new File(["image"], "avatar.webp", { type: "image/webp" });
const fixture = () => {
  const preparation = prepared();
  const signed: CompleteWalletSignatureResponse = {
    namespace: "eip155",
    walletId: wallet.id,
    account: wallet.address,
    operationId: preparation.operationId,
    chainId: "eip155:1",
    type: "message",
    signature: Hex.make("0x1234"),
  };
  return {
    assertActive: vi.fn(),
    progress: vi.fn(),
    authorize: vi.fn(async () => ({ message, expiresAt: Date.now() + 60_000 })),
    prepare: vi.fn(async () => preparation),
    authenticate: vi.fn(),
    complete: vi.fn(async () => signed),
    upload: vi.fn(async () => "https://metadata.namespace.ninja/example/avatar"),
    save: vi.fn(async () => undefined),
    saved: vi.fn(),
  };
};

describe("identity artwork approval and recovery", () => {
  it("signs, uploads directly, then saves the record, independently for each image", async () => {
    const deps = fixture();
    await saveArtwork({ avatar: file, header: file }, {}, wallet, undefined, deps);
    expect(deps.complete).toHaveBeenCalledTimes(2);
    expect(deps.authenticate).not.toHaveBeenCalled();
    expect(deps.upload).toHaveBeenNthCalledWith(1, "avatar", file, message, "0x1234");
    expect(deps.upload).toHaveBeenNthCalledWith(2, "header", file, message, "0x1234");
    expect(deps.complete.mock.invocationCallOrder[0]).toBeLessThan(
      Number(deps.upload.mock.invocationCallOrder[0]),
    );
    expect(deps.upload.mock.invocationCallOrder[0]).toBeLessThan(
      Number(deps.save.mock.invocationCallOrder[0]),
    );
    expect(deps.saved).toHaveBeenCalledTimes(2);
  });
  it("reuses an uploaded image after a record-write failure without signing or uploading again", async () => {
    const deps = fixture();
    const uploads: UploadedArtwork = {};
    deps.save.mockRejectedValueOnce(new Error("Record unavailable"));
    await expect(
      saveArtwork({ avatar: file, header: null }, uploads, wallet, undefined, deps),
    ).rejects.toThrow();
    expect(uploads.avatar?.file).toBe(file);
    await saveArtwork({ avatar: file, header: null }, uploads, wallet, undefined, deps);
    expect(deps.complete).toHaveBeenCalledOnce();
    expect(deps.upload).toHaveBeenCalledOnce();
    expect(deps.save).toHaveBeenCalledTimes(2);
    expect(uploads.avatar).toBeUndefined();
  });
  it("stops after a context change during signing, without uploading or saving", async () => {
    const deps = fixture();
    deps.complete.mockImplementationOnce(async () => {
      deps.assertActive.mockImplementation(() => {
        throw new Error("Context changed");
      });
      return fixture().complete();
    });
    await expect(
      saveArtwork({ avatar: file, header: null }, {}, wallet, undefined, deps),
    ).rejects.toThrow("Context changed");
    expect(deps.upload).not.toHaveBeenCalled();
    expect(deps.save).not.toHaveBeenCalled();
  });
  it("does not upload a signature returned for another account", async () => {
    const deps = fixture();
    deps.complete.mockResolvedValueOnce({
      ...(await deps.complete()),
      account: EthereumAddress.make("0x0000000000000000000000000000000000000002"),
    });
    await expect(
      saveArtwork({ avatar: file, header: null }, {}, wallet, undefined, deps),
    ).rejects.toMatchObject({ code: "APPROVAL_INVALID" });
    expect(deps.upload).not.toHaveBeenCalled();
  });
  it("rejects an altered message before signing", async () => {
    const deps = fixture();
    deps.prepare.mockResolvedValueOnce({
      ...prepared(),
      request: {
        namespace: "eip155",
        chainId: "eip155:1",
        type: "message",
        message: "Different permission",
      },
    });
    await expect(
      saveArtwork({ avatar: file, header: null }, {}, wallet, undefined, deps),
    ).rejects.toMatchObject({ code: "APPROVAL_INVALID" });
    expect(deps.complete).not.toHaveBeenCalled();
  });
  it("does not persist an unsafe upload URL", async () => {
    const deps = fixture();
    deps.upload.mockResolvedValueOnce("javascript:alert(1)");
    await expect(
      saveArtwork({ avatar: file, header: null }, {}, wallet, undefined, deps),
    ).rejects.toMatchObject({ code: "UPLOAD_FAILED" });
    expect(deps.save).not.toHaveBeenCalled();
  });
  it("binds passkey approval to the exact challenge, relying party and owner credential", () => {
    const local = {
      ...wallet,
      owner: { ...wallet.owner, custody: "local", algorithm: "p256" },
    } as WalletResponse;
    const descriptor = {
      walletId: wallet.id,
      owner: {
        signingKeyId: wallet.owner.signingKeyId,
        rpId: "dashboard.namera.ai",
        credentialId: "credential",
      },
    } as GetWalletPasskeyOwnerResponse;
    const approval: PrepareWalletSignatureResponse = {
      ...prepared(),
      signing: {
        method: "passkey",
        options: {
          challenge: ownerMessageChallenge(wallet.address, 1, message),
          rpId: "dashboard.namera.ai",
          userVerification: "required",
          timeout: 60_000,
          allowCredentials: [{ id: "credential", type: "public-key" }],
        },
      },
    };
    expect(() => validateArtworkApproval(local, message, approval, descriptor)).not.toThrow();
    if (approval.signing.method !== "passkey") throw new Error("fixture");
    const options = approval.signing.options;
    for (const altered of [
      { ...options, challenge: ownerMessageChallenge(wallet.address, 1, "different") },
      { ...options, rpId: "different.example" },
      { ...options, allowCredentials: [] },
    ]) {
      expect(() =>
        validateArtworkApproval(
          local,
          message,
          { ...approval, signing: { method: "passkey", options: altered } },
          descriptor,
        ),
      ).toThrow();
    }
  });
  it.each(["avatar", "header"] as const)("enforces the same upload boundary for %s", (kind) => {
    const valid = new File([new Uint8Array(artworkLimit)], "photo.png", { type: "image/png" });
    expect(Schema.is(ArtworkSchema)({ avatar: null, header: null, [kind]: valid })).toBe(true);
    const oversized = new File([new Uint8Array(artworkLimit + 1)], "photo.png", {
      type: "image/png",
    });
    expect(Schema.is(ArtworkSchema)({ avatar: null, header: null, [kind]: oversized })).toBe(false);
    const svg = new File(["<svg/>"], "photo.svg", { type: "image/svg+xml" });
    expect(Schema.is(ArtworkSchema)({ avatar: null, header: null, [kind]: svg })).toBe(false);
  });
});
