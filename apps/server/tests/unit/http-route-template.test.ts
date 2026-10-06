import { HttpApi } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";
import { httpRouteTemplate } from "@namera-ai/telemetry";
import { describe, expect, it } from "vitest";

describe("telemetry route templates", () => {
  it("recognizes every typed API route without leaking identifiers or queries", () => {
    HttpApi.reflect(NameraApi, {
      onGroup: () => {},
      onEndpoint: ({ endpoint }) => {
        const template = endpoint.path.replace(/\/$/, "") || "/";
        const path = template.replace(/:[^/]+/g, "private-value");
        expect(httpRouteTemplate(`${path}?token=private-token`)).toBe(template);
      },
    });
  });

  it.each([
    "/oauth/authorize",
    "/oauth/register",
    "/oauth/token",
    "/oauth/revoke",
    "/oauth/device/authorize",
    "/.well-known/oauth-authorization-server",
    "/.well-known/oauth-protected-resource",
  ])("recognizes raw protocol route %s", (path) => {
    expect(httpRouteTemplate(`${path}?code=private-code`)).toBe(path);
  });

  it("keeps unknown URLs bounded and static routes ahead of parameter routes", () => {
    expect(httpRouteTemplate("/unknown/private-value")).toBe("/*");
    expect(httpRouteTemplate("https://api.test/session-keys/operations/prepare/")).toBe(
      "/session-keys/operations/prepare",
    );
    expect(httpRouteTemplate("/session-keys/operations/private-id")).toBe(
      "/session-keys/operations/:operationId",
    );
  });
});
