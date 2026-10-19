import type { GetDashboardOverviewResponse, SessionKeyResponse } from "@namera-ai/protocol/dto";
import type { MemberPermission } from "@namera-ai/protocol/model";

export const gettingStartedReadPermissions = [
  "wallet:read",
  "session-key:read",
  "execution:read",
  "billing:read",
] as const satisfies readonly MemberPermission[];

export type GettingStartedMilestones = readonly [boolean, boolean, boolean, boolean];

export function gettingStartedSessionProgress(sessionKeys: readonly SessionKeyResponse[]) {
  const enabled = sessionKeys.some(
    (sessionKey) =>
      sessionKey.status === "active" &&
      sessionKey.installations.some((installation) => installation.status === "installed"),
  );
  const approvalSessionKey = enabled
    ? undefined
    : sessionKeys.find(
        (sessionKey) =>
          (sessionKey.status === "pending" || sessionKey.status === "active") &&
          sessionKey.installations.some(
            (installation) =>
              installation.status === "pending" ||
              installation.status === "failed" ||
              installation.status === "submitted",
          ),
      );

  return { enabled, approvalSessionKey };
}

export function gettingStartedMilestones(
  overview: GetDashboardOverviewResponse | undefined,
  usedConnection: boolean,
  enabledSessionKey = false,
): GettingStartedMilestones {
  return [
    (overview?.resources.accounts.total ?? 0) > 0,
    enabledSessionKey,
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
