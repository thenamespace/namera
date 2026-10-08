import { createMemoryHistory } from "@tanstack/react-router";

import { Effect } from "effect";
import { AtomRegistry } from "effect/reactivity";

import { afterEach, expect, it, vi } from "vitest";

import { overviewAtom } from "../src/atoms/overview";
import { getRouter } from "../src/router";

afterEach(() => vi.unstubAllGlobals());

it.each([true, false])(
  "prefetches overview only when permitted (%s) and reuses its atom cache",
  async (allowed) => {
    const totals = {
      users: 2,
      waitlist: 1,
      accounts: 3,
      sessionKeys: 4,
      executions: 5,
      signatures: 6,
    };
    const requests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>((input) => {
        const url = String(input instanceof Request ? input.url : input);
        requests.push(url);
        return Promise.resolve(
          Response.json(
            url.includes("/internal/overview")
              ? {
                  generatedAt: "2026-10-08T12:00:00.000Z",
                  period: "30d",
                  totals,
                  periodCounts: totals,
                  current: { pendingWaitlist: 1, activeSessionKeys: 4, revokedSessionKeys: 0 },
                  activity: [{ date: "2026-10-08", ...totals }],
                }
              : {
                  member: {
                    id: "member-1",
                    userId: "01900000-0000-7000-8000-000000000001",
                    role: "viewer",
                    status: "active",
                    createdAt: "2026-10-01T00:00:00.000Z",
                    updatedAt: "2026-10-01T00:00:00.000Z",
                  },
                  email: "viewer@example.com",
                  permissions: allowed ? ["overview:read"] : [],
                },
          ),
        );
      }),
    );
    const router = getRouter();
    router.update({
      context: router.options.context,
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    try {
      await router.load();
      expect(router.state.matches.every((match) => match.status === "success")).toBe(true);
      if (allowed) {
        const response = await Effect.runPromise(
          AtomRegistry.getResult(router.options.context.atomRegistry, overviewAtom()),
        );
        expect(response.totals).toEqual(totals);
      }
      expect(requests.filter((url) => url.includes("/internal/overview"))).toHaveLength(
        allowed ? 1 : 0,
      );
    } finally {
      router.options.context.atomRegistry.dispose();
    }
  },
);
