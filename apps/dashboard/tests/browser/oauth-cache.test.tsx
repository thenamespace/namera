import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Schema } from "effect";
import { AsyncResult, AtomRegistry } from "effect/reactivity";

import { OAuthAuthorizationResponse } from "@namera-ai/protocol/dto";
import { afterEach, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import { currentUserAtom } from "../../src/atoms/auth/session";
import {
  useApproveOAuthAuthorizationRequest,
  useApproveOAuthDeviceAuthorization,
  useCliAuthorizations,
  useMcpAuthorizations,
} from "../../src/hooks/auth/oauth";
import { actor } from "../fixtures/actor";
import { cliRequest, consentSession, oauthRequest } from "../fixtures/consent";

vi.mock("../../src/env", () => ({
  env: { backendUrl: "https://api.example.test", environment: "test" },
}));
vi.mock("../../src/telemetry", async () => {
  const { Atom } = await import("effect/reactivity");
  const { Layer } = await import("effect");
  const { FetchHttpClient } = await import("effect/http");
  const dashboardRuntime = Atom.context();
  dashboardRuntime.addGlobalLayer(
    Layer.succeed(FetchHttpClient.Fetch)((...args) => globalThis.fetch(...args)),
  );
  return { dashboardRuntime };
});

afterEach(() => vi.mocked(globalThis.fetch).mockClear());

it.each(["mcp", "cli"] as const)("refreshes cached %s connections after approval", async (type) => {
  const authorization = Schema.decodeUnknownSync(OAuthAuthorizationResponse)({
    id: "01950000-0000-7000-8000-000000000020",
    organizationId: actor.organization.id,
    actorId: actor.actorId,
    type,
    client: Schema.encodeSync(OAuthAuthorizationResponse.fields.client)(oauthRequest.client),
    authorizedBy: Schema.encodeSync(OAuthAuthorizationResponse.fields.authorizedBy)(actor.member),
    scopes: oauthRequest.requestedScopes,
    resource: oauthRequest.resource,
    status: "active",
    metadata:
      type === "mcp"
        ? { type, version: 1 }
        : { type, version: 1, deviceName: "Test laptop", cliVersion: "1.0.0", platform: "darwin" },
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    sessionKeys: [],
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
  });
  const listPath = type === "mcp" ? "/oauth/authorizations" : "/oauth/cli-authorizations";
  const approvalPath =
    type === "mcp"
      ? "/oauth/authorization-requests/approve"
      : "/oauth/device-authorizations/approve";
  let approved = false;
  vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname.replace(/\/$/, "");
    if (request.method === "GET" && path === listPath)
      return Response.json(
        approved ? [Schema.encodeSync(OAuthAuthorizationResponse)(authorization)] : [],
      );
    if (request.method === "POST" && path === approvalPath) {
      approved = true;
      return Response.json(
        type === "mcp"
          ? { redirectUrl: "https://client.example/callback" }
          : { status: "approved" },
      );
    }
    throw new Error(`Unexpected request ${request.method} ${path}`);
  });
  const registry = AtomRegistry.make({
    scheduleTask,
    initialValues: [[currentUserAtom, AsyncResult.success(actor)]],
  });
  const useConnections = type === "mcp" ? useMcpAuthorizations : useCliAuthorizations;
  const view = await renderHook(
    () => ({
      connections: useConnections(),
      approveMcp: useApproveOAuthAuthorizationRequest(),
      approveCli: useApproveOAuthDeviceAuthorization(),
    }),
    {
      wrapper: ({ children }) => (
        <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>
      ),
    },
  );
  try {
    await expect.poll(() => view.result.current.connections.data).toEqual([]);
    const grants = { organizationId: actor.organization.id, sessionKeyIds: [consentSession.id] };
    await view.act(() =>
      type === "mcp"
        ? view.result.current.approveMcp.mutateAsync({
            payload: { ...grants, requestId: oauthRequest.id, expiresAt: null },
          })
        : view.result.current.approveCli.mutateAsync({
            payload: { ...grants, deviceAuthorizationId: cliRequest.id },
          }),
    );
    await expect.poll(() => view.result.current.connections.data?.[0]?.id).toBe(authorization.id);
  } finally {
    await view.unmount();
    registry.dispose();
  }
});
