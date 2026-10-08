import { createMemoryHistory } from "@tanstack/react-router";

import { afterEach, describe, expect, it, vi } from "vitest";

import { getRouter } from "../src/router";

const paths = ["/", "/waitlist", "/invites", "/team", "/activity"];
const fetchMock = vi.fn<typeof fetch>();

afterEach(() => vi.unstubAllGlobals());

describe("admin page access", () => {
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
