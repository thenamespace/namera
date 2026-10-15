import { DateTime, Schema } from "effect";

import { ownerMessageChallenge } from "@namera-ai/evm/signature-review";
import { EthereumAddress, Hex, SignatureOperationId } from "@namera-ai/protocol";
import {
  WalletResponse,
  type PrepareWalletSignatureResponse,
  type CompleteWalletSignatureResponse,
  GetWalletPasskeyOwnerResponse,
} from "@namera-ai/protocol/dto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ArtworkSchema,
  artworkLimit,
} from "../../../src/routes/_authenticated/identity/-components/artwork-schema";
import {
  saveArtwork,
  validateArtworkApproval,
  type UploadedArtwork,
} from "../../../src/routes/_authenticated/identity/-components/artwork-upload";
import { managedWallet as wallet } from "../../fixtures/wallet-transaction";

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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

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
  it.each([
    "javascript:alert(1)",
    "http://example.test/image",
    "https://user:password@example.test/image",
    "not a URL",
  ])("does not persist an unsafe upload URL: %s", async (url) => {
    const deps = fixture();
    deps.upload.mockResolvedValueOnce(url);
    await expect(
      saveArtwork({ avatar: file, header: null }, {}, wallet, undefined, deps),
    ).rejects.toMatchObject({ code: "UPLOAD_FAILED" });
    expect(deps.save).not.toHaveBeenCalled();
  });
  it("keeps only the unfinished header cached after partial record failure", async () => {
    const deps = fixture();
    const uploads: UploadedArtwork = {};
    deps.save
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Header write failed"));
    await expect(
      saveArtwork({ avatar: file, header: file }, uploads, wallet, undefined, deps),
    ).rejects.toThrow("Header write failed");
    expect(uploads.avatar).toBeUndefined();
    expect(uploads.header?.file).toBe(file);
    expect(deps.saved).toHaveBeenCalledExactlyOnceWith("avatar", file, expect.any(String));

    await saveArtwork({ avatar: null, header: file }, uploads, wallet, undefined, deps);
    expect(deps.authorize).toHaveBeenCalledTimes(2);
    expect(deps.complete).toHaveBeenCalledTimes(2);
    expect(deps.upload).toHaveBeenCalledTimes(2);
    expect(deps.save).toHaveBeenCalledTimes(3);
    expect(uploads).toEqual({});
  });
  it("does not reuse a cached URL when the selected file changes", async () => {
    const deps = fixture();
    const replacement = new File(["new image"], "replacement.webp", { type: "image/webp" });
    const uploads: UploadedArtwork = { avatar: { file, url: "https://example.test/old" } };
    await saveArtwork({ avatar: replacement, header: null }, uploads, wallet, undefined, deps);
    expect(deps.authorize).toHaveBeenCalledExactlyOnceWith("avatar");
    expect(deps.upload).toHaveBeenCalledExactlyOnceWith("avatar", replacement, message, "0x1234");
    expect(deps.save).not.toHaveBeenCalledWith("avatar", "https://example.test/old");
  });
  it("rejects authorization at exact expiry before signing", async () => {
    const deps = fixture();
    deps.authorize.mockResolvedValueOnce({ message, expiresAt: Date.now() });
    await expect(
      saveArtwork({ avatar: file, header: null }, {}, wallet, undefined, deps),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_EXPIRED" });
    expect(deps.complete).not.toHaveBeenCalled();
    expect(deps.upload).not.toHaveBeenCalled();
    expect(deps.save).not.toHaveBeenCalled();
  });
  it("rechecks authorization expiry after signing before upload", async () => {
    const deps = fixture();
    const signed = await deps.complete();
    deps.complete.mockClear().mockImplementationOnce(async () => {
      vi.setSystemTime(Date.now() + 60_000);
      return signed;
    });
    await expect(
      saveArtwork({ avatar: file, header: null }, {}, wallet, undefined, deps),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_EXPIRED" });
    expect(deps.complete).toHaveBeenCalledOnce();
    expect(deps.upload).not.toHaveBeenCalled();
    expect(deps.save).not.toHaveBeenCalled();
  });
  it("binds passkey approval to the exact challenge, relying party and owner credential", () => {
    const local = Schema.decodeUnknownSync(WalletResponse)({
      ...Schema.encodeSync(WalletResponse)(wallet),
      owner: { signingKeyId: wallet.owner.signingKeyId, custody: "local", algorithm: "p256" },
      data: {
        version: 1,
        modularAccountVersion: "2.0.0",
        entryPointVersion: "0.7",
        validatorType: "webauthn_p256",
        salt: "0",
        entityId: 0,
      },
    });
    const descriptor = Schema.decodeUnknownSync(GetWalletPasskeyOwnerResponse)({
      walletId: wallet.id,
      owner: {
        signingKeyId: wallet.owner.signingKeyId,
        rpId: "dashboard.namera.ai",
        credentialId: "credential",
        publicKeyHex: `0x${"11".repeat(64)}`,
      },
    });
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
    const empty = new File([], "photo.png", { type: "image/png" });
    expect(Schema.is(ArtworkSchema)({ avatar: null, header: null, [kind]: empty })).toBe(false);
  });
});
