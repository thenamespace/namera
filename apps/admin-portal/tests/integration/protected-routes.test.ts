import type { PlatformPermission } from "@namera-ai/protocol/model";
import { describe, expect, it } from "vitest";

import { adminResponse } from "../fixtures/admin";
import { routeFixture } from "../support/router";

const id = "01950000-0000-7000-8000-000000000001";
const routes = [
  "/",
  "/waitlist",
  "/invites",
  "/team",
  "/catalog",
  `/catalog/${id}`,
  "/interface",
  `/interface/${id}`,
  "/feedback",
  `/feedback/${id}`,
];

describe("admin route authority", () => {
  it.each(routes)("redirects unauthenticated access to %s", async (path) => {
    const { router, requests } = routeFixture(path, () => new Response(null, { status: 401 }));
    await router.load();

    // Node router redirects are exposed through the server result rather than navigation.
    // oxlint-disable-next-line eslint/no-underscore-dangle
    expect(router._serverResult).toMatchObject({
      type: "redirect",
      redirect: { options: { to: "/auth" } },
    });
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((url) => url.pathname === "/internal/me")).toBe(true);
  });

  it.each(routes)("does not prefetch %s without its capability", async (path) => {
    const { router, requests } = routeFixture(path, (url) => {
      if (url.pathname !== "/internal/me") throw new Error(`Unexpected request: ${url.pathname}`);
      return Response.json(adminResponse([], "owner"));
    });
    await router.load();

    expect(router.state.matches.every((match) => match.status === "success")).toBe(true);
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((url) => url.pathname === "/internal/me")).toBe(true);
  });

  it.each([
    {
      path: "/catalog",
      endpoint: "/internal/catalog",
      permission: "catalog:read",
      response: { entries: [], nextOffset: null },
    },
    {
      path: "/interface",
      endpoint: "/internal/interfaces",
      permission: "catalog:read",
      response: { entries: [], nextOffset: null },
    },
    { path: "/team", endpoint: "/internal/members", permission: "team:read", response: [] },
    {
      path: "/feedback",
      endpoint: "/internal/feedback",
      permission: "feedback:read",
      response: { entries: [], nextCursor: null },
    },
  ] satisfies readonly {
    path: string;
    endpoint: string;
    permission: PlatformPermission;
    response: unknown;
  }[])(
    "prefetches $path with its explicit capability even for a viewer",
    async ({ path, endpoint, permission, response }) => {
      const { router, requests } = routeFixture(path, (url) => {
        if (url.pathname === "/internal/me") return Response.json(adminResponse([permission]));
        if (url.pathname === endpoint) return Response.json(response);
        throw new Error(`Unexpected request: ${url.pathname}`);
      });
      await router.load();

      expect(router.state.matches.every((match) => match.status === "success")).toBe(true);
      expect(requests.filter((url) => url.pathname === endpoint)).toHaveLength(1);
    },
  );

  it("fetches authorized feedback detail and preserves a missing-record failure", async () => {
    const endpoint = `/internal/feedback/${id}`;
    const { router, requests } = routeFixture(`/feedback/${id}`, (url) => {
      if (url.pathname === "/internal/me") return Response.json(adminResponse(["feedback:read"]));
      if (url.pathname === endpoint) return new Response(null, { status: 404 });
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    await router.load();

    expect(requests.filter((url) => url.pathname === endpoint)).toHaveLength(1);
    expect(router.state.matches.some((match) => match.status === "error")).toBe(true);
  });

  it("keeps connection failures on the retry boundary without fetching protected data", async () => {
    const { router, requests } = routeFixture("/waitlist", () => {
      throw new TypeError("Network unavailable");
    });
    await router.load();

    expect(router.state.matches.some((match) => match.status === "error")).toBe(true);
    expect(requests.every((url) => url.pathname === "/internal/me")).toBe(true);
  });
});
