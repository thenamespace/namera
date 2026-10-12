import { Cache, DateTime, Effect, Exit } from "effect";

import { Repository } from "@namera-ai/database";
import type {
  AdminOverviewCounts,
  AdminOverviewPeriod,
  GetAdminOverviewResponse,
} from "@namera-ai/protocol/dto";

import { requirePlatformPermission, type PlatformSession } from "#/auth/platform/access";

const daysByPeriod = { "7d": 7, "30d": 30, "90d": 90 } as const;

export const makeAdminOverviewApplication = Effect.gen(function* () {
  const repository = yield* Repository;
  // Recent periods share a snapshot; all-time history is loaded only on request.
  const snapshot = yield* Cache.makeWith(
    Effect.fn("application.adminOverview.refresh")(function* (key: "recent" | "all") {
      const generatedAt = yield* DateTime.now;
      const counts = yield* repository.core.adminOverview.snapshot(generatedAt, key === "all");
      return { ...counts, generatedAt };
    }),
    { capacity: 2, timeToLive: (exit) => (Exit.isSuccess(exit) ? "60 seconds" : "0 seconds") },
  );

  const get = Effect.fn("application.adminOverview.get")(
    function* (context: PlatformSession, period: AdminOverviewPeriod = "30d") {
      yield* requirePlatformPermission(repository, context, "overview:read");
      const overview = yield* Cache.get(snapshot, period === "all" ? "all" : "recent");
      const activity =
        period === "all" ? overview.activity : overview.activity.slice(-daysByPeriod[period]);
      const periodCounts: AdminOverviewCounts = activity.reduce(
        (sum, point) => ({
          users: sum.users + point.users,
          waitlist: sum.waitlist + point.waitlist,
          accounts: sum.accounts + point.accounts,
          sessionKeys: sum.sessionKeys + point.sessionKeys,
          executions: sum.executions + point.executions,
          signatures: sum.signatures + point.signatures,
        }),
        {
          users: 0,
          waitlist: 0,
          accounts: 0,
          sessionKeys: 0,
          executions: 0,
          signatures: 0,
        },
      );
      return { ...overview, period, activity, periodCounts } satisfies GetAdminOverviewResponse;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
  return { get };
});
