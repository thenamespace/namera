import { Option } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";

import { isAccessRejection } from "@/atoms/auth/browser-session";
import { gettingStartedMilestones, gettingStartedReadPermissions } from "@/lib/getting-started";
import { queryData } from "@/lib/query-data";

import { apiKeysAtom } from "./api-key";
import { cliAuthorizationsAtom, mcpAuthorizationsAtom } from "./auth/oauth";
import { currentUserAtom } from "./auth/session";
import { dashboardOverviewAtom } from "./dashboard";

export const inactiveGettingStartedAtom = Atom.make({
  available: false,
  completed: gettingStartedMilestones(undefined, false),
  isLoading: false,
  isError: false,
  accessRejected: false,
});

export const gettingStartedAtom = Atom.make((get) => {
  const actor = queryData(get(currentUserAtom));
  const permissions = actor?.role.permissions ?? [];
  if (
    !actor ||
    !gettingStartedReadPermissions.every((permission) => permissions.includes(permission))
  ) {
    return get(inactiveGettingStartedAtom);
  }

  const overview = get(dashboardOverviewAtom);
  const apiKeys = permissions.includes("api-key:read") ? get(apiKeysAtom) : undefined;
  const cli = permissions.includes("cli-authorization:read")
    ? get(cliAuthorizationsAtom)
    : undefined;
  const mcp = permissions.includes("mcp-authorization:read")
    ? get(mcpAuthorizationsAtom)
    : undefined;
  const results: readonly (AsyncResult.AsyncResult<unknown, unknown> | undefined)[] = [
    overview,
    apiKeys,
    cli,
    mcp,
  ];
  const usedConnection = [
    apiKeys && queryData(apiKeys),
    cli && queryData(cli),
    mcp && queryData(mcp),
  ].some((connections) => connections?.some((connection) => connection.lastUsedAt !== null));
  const summary = queryData(overview);

  return {
    available: true,
    completed: gettingStartedMilestones(
      summary?.organizationId === actor.organization.id ? summary : undefined,
      usedConnection,
    ),
    isLoading: results.some((result) => result && AsyncResult.isInitial(result)),
    isError: results.some((result) => result && AsyncResult.isFailure(result)),
    accessRejected: results.some(
      (result) => result && isAccessRejection(Option.getOrUndefined(AsyncResult.error(result))),
    ),
  };
});
