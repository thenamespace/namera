import { afterEach, describe, expect, it, vi } from "vitest";

import { pollDeviceToken, startDeviceAuthorization } from "../../../src/services/oauth.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CLI OAuth client", () => {
  it("starts the device flow with the CLI identity and delegated scopes", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({ "content-type": "application/x-www-form-urlencoded" });

      const body = init?.body;
      expect(body).toBeInstanceOf(URLSearchParams);
      expect((body as URLSearchParams).get("client_id")).toBe("namera-cli");
      expect((body as URLSearchParams).get("resource")).toBe("https://api.namera.ai");
      expect((body as URLSearchParams).get("scope")).toContain("execution:execute");

      return new Response(
        JSON.stringify({
          device_code: "device-code",
          user_code: "ABCD-EFGH",
          verification_uri: "https://dashboard.namera.ai/cli/authorize",
          verification_uri_complete:
            "https://dashboard.namera.ai/cli/authorize?user_code=ABCD-EFGH",
          expires_in: 600,
          interval: 5,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await startDeviceAuthorization("https://api.namera.ai/", {
      deviceName: "Developer Mac",
      cliVersion: "0.1.0",
      platform: "darwin-arm64",
    });

    expect(response.user_code).toBe("ABCD-EFGH");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("normalizes a successful token response into stored credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              access_token: "access-token",
              refresh_token: "refresh-token",
              expires_in: 3600,
              scope: "wallet:read session-key:read offline_access",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    const before = Date.now();
    const credentials = await pollDeviceToken("https://api.namera.ai", "device-code");

    expect(credentials).toMatchObject({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      scopes: ["wallet:read", "session-key:read", "offline_access"],
    });
    expect(credentials.expiresAt).toBeGreaterThanOrEqual(before + 3_600_000);
  });

  it("preserves OAuth error codes for polling decisions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: "authorization_pending",
              error_description: "Authorization is still pending",
            }),
            { status: 400, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    await expect(pollDeviceToken("https://api.namera.ai", "device-code")).rejects.toMatchObject({
      code: "authorization_pending",
      message: "Authorization is still pending",
    });
  });
});
