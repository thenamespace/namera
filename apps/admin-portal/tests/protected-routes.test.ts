import { createMemoryHistory } from "@tanstack/react-router";

import { afterEach, describe, expect, it, vi } from "vitest";

import { navigationGroups } from "../src/components/sidebar/navigation";
import { getRouter } from "../src/router";

const paths = ["/", "/waitlist", "/invites", "/team"];
const fetchMock = vi.fn<typeof fetch>();

afterEach(() => vi.unstubAllGlobals());

describe("admin page access", () => {
  it("does not expose the retired Activity page or navigation item", () => {
    const router = getRouter();
    try {
      expect(Object.keys(router.routesByPath)).not.toContain("/activity");
      expect(
        navigationGroups.flatMap((group) => group.items.map((item) => item.href)),
      ).not.toContain("/activity");
    } finally {
      router.options.context.atomRegistry.dispose();
    }
  });
  it("prefetches the owner member table with display metadata", async () => {
    const member = {
      id: "member-1",
      userId: "01900000-0000-7000-8000-000000000001",
      role: "owner",
      status: "active",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    };
    const requests: string[] = [];
    fetchMock.mockImplementation((input) => {
      const url = String(input instanceof Request ? input.url : input);
      requests.push(url);
      return Promise.resolve(
        Response.json(
          url.endsWith("/internal/members")
            ? [
                {
                  ...member,
                  email: "owner@example.com",
                  metadata: { version: 1, name: "Team Owner" },
                },
              ]
            : {
                member,
                email: "owner@example.com",
                permissions: ["team:manage", "ownership:transfer"],
              },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const router = getRouter();
    router.update({
      context: router.options.context,
      history: createMemoryHistory({ initialEntries: ["/team"] }),
    });
    try {
      await router.load();
      expect(router.state.matches.every((match) => match.status === "success")).toBe(true);
      expect(requests.filter((url) => url.endsWith("/internal/members"))).toHaveLength(1);
    } finally {
      router.options.context.atomRegistry.dispose();
    }
  });
  it.each(["operator", "viewer"])("does not fetch the member list for %s", async (role) => {
    const requests: string[] = [];
    fetchMock.mockImplementation((input) => {
      requests.push(String(input instanceof Request ? input.url : input));
      return Promise.resolve(
        Response.json({
          member: {
            id: "member-1",
            userId: "01900000-0000-7000-8000-000000000001",
            role,
            status: "active",
            createdAt: "2026-10-01T00:00:00.000Z",
            updatedAt: "2026-10-01T00:00:00.000Z",
          },
          email: "team@example.com",
          permissions: [],
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const router = getRouter();
    router.update({
      context: router.options.context,
      history: createMemoryHistory({ initialEntries: ["/team"] }),
    });
    try {
      await router.load();
      expect(router.state.matches.every((match) => match.status === "success")).toBe(true);
      expect(requests.some((url) => url.endsWith("/internal/me"))).toBe(true);
      expect(requests.some((url) => url.endsWith("/internal/members"))).toBe(false);
    } finally {
      router.options.context.atomRegistry.dispose();
    }
  });
  it.each(paths)("requires admin access at %s", async (path) => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 401 })));
    vi.stubGlobal("fetch", fetchMock);
    const router = getRouter();
    router.update({
      context: router.options.context,
      history: createMemoryHistory({ initialEntries: [path] }),
    });
    try {
      await router.load();
      // TanStack keeps Node-mode redirects here rather than in browser state.
      // oxlint-disable-next-line eslint/no-underscore-dangle
      expect(router._serverResult).toMatchObject({
        type: "redirect",
        redirect: { options: { to: "/auth" } },
      });
    } finally {
      router.options.context.atomRegistry.dispose();
    }
  });

  it("keeps connection failures on the retry boundary", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    const router = getRouter();
    router.update({
      context: router.options.context,
      history: createMemoryHistory({ initialEntries: ["/waitlist"] }),
    });
    try {
      await router.load();
      expect(router.state.matches.some((match) => match.status === "error")).toBe(true);
    } finally {
      router.options.context.atomRegistry.dispose();
    }
  });
});
