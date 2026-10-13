import { parseSiweMessage } from "viem/siwe";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  authorizeArtwork,
  uploadArtwork,
} from "../../../src/routes/_authenticated/identity/-components/namespace-artwork";

const address = "0x0000000000000000000000000000000000000001";
const signal = new AbortController().signal;
afterEach(() => vi.unstubAllGlobals());

describe("Namespace browser upload protocol", () => {
  it("requests a scoped nonce without cookies and constructs the exact mainnet SIWE intent locally", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ nonce: "testnonce123", expiresAt: Date.now() + 60_000 }),
    );
    vi.stubGlobal("fetch", fetch);
    const authorization = await authorizeArtwork(
      "header",
      address,
      "http://localhost:3000",
      signal,
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://metadata.namespace.ninja/auth/nonce",
      expect.objectContaining({
        credentials: "omit",
        redirect: "error",
        body: JSON.stringify({ address, scope: "header" }),
      }),
    );
    expect(parseSiweMessage(authorization.message)).toMatchObject({
      address,
      domain: "localhost:3000",
      uri: "http://localhost:3000",
      chainId: 1,
      version: "1",
      nonce: "testnonce123",
      statement: "Authorize a metadata update",
    });
  });
  it.each(["avatar", "header"] as const)(
    "uploads the original %s file as multipart, not a transformed image",
    async (kind) => {
      let multipart: FormData | undefined;
      const fetch = vi.fn(async (_url: string, init: RequestInit) => {
        multipart = init.body as FormData;
        return Response.json({
          [kind === "header" ? "headerUrl" : "avatarUrl"]:
            "https://metadata.namespace.ninja/profile/image",
        });
      });
      vi.stubGlobal("fetch", fetch);
      const file = new File([new Uint8Array([1, 2, 3])], "original.webp", { type: "image/webp" });
      await expect(
        uploadArtwork(kind, file, "example.namera.id", address, "message", "signature", signal),
      ).resolves.toBe("https://metadata.namespace.ninja/profile/image");
      expect(fetch).toHaveBeenCalledWith(
        `https://metadata.namespace.ninja/profile/mainnet/example.namera.id/${kind}`,
        expect.objectContaining({ credentials: "omit", method: "POST" }),
      );
      expect(multipart?.get("siweMessage")).toBe("message");
      expect(multipart?.get("siweSignature")).toBe("signature");
      expect(multipart?.get("address")).toBe(address);
      const sent = multipart?.get(kind) as File;
      expect(sent.name).toBe(file.name);
      expect(new Uint8Array(await sent.arrayBuffer())).toEqual(
        new Uint8Array(await file.arrayBuffer()),
      );
    },
  );
  it("rejects malformed nonce responses before requesting a signature", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ nonce: "inject\npermission", expiresAt: Date.now() + 60_000 }),
      ),
    );
    await expect(
      authorizeArtwork("avatar", address, "https://dashboard.namera.ai", signal),
    ).rejects.toMatchObject({ code: "UPLOAD_FAILED" });
  });
  it("does not expose provider failures containing credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("siweSignature=secret");
      }),
    );
    try {
      await authorizeArtwork("avatar", address, "https://dashboard.namera.ai", signal);
      throw new Error("Expected failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "UPLOAD_FAILED" });
      expect(JSON.stringify(error)).not.toContain("secret");
    }
  });
});
