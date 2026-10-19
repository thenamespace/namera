import type { GetDashboardOverviewResponse } from "@namera-ai/protocol/dto";
import type { MemberPermission } from "@namera-ai/protocol/model";

export const gettingStartedReadPermissions = [
  "wallet:read",
  "session-key:read",
  "execution:read",
  "billing:read",
] as const satisfies readonly MemberPermission[];

export type GettingStartedMilestones = readonly [boolean, boolean, boolean, boolean];

export function gettingStartedMilestones(
  overview: GetDashboardOverviewResponse | undefined,
  usedConnection: boolean,
): GettingStartedMilestones {
  return [
    (overview?.resources.accounts.total ?? 0) > 0,
    (overview?.resources.sessionKeys.total ?? 0) > 0,
    usedConnection ||
      (overview?.namespaces.some((namespace) =>
        namespace.executionSources.some(
          (source) => source.actorType !== "user" && source.count > 0,
        ),
      ) ??
        false),
    overview?.namespaces.some(
      (namespace) => namespace.totals.executions > 0n || namespace.totals.signatures > 0n,
    ) ?? false,
  ];
}

export function gettingStartedStorageKey(userId: string, organizationId: string) {
  return `namera:getting-started:v1:${userId}:${organizationId}`;
}
