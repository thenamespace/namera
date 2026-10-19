import { useCallback, useContext, useEffect } from "react";

import { RegistryContext, useAtomValue } from "@effect/atom-react";

import type { MemberPermission } from "@namera-ai/protocol/model";
import { useLocalStorage } from "usehooks-ts";

import { apiKeysAtom } from "@/atoms/api-key";
import { cliAuthorizationsAtom, mcpAuthorizationsAtom } from "@/atoms/auth/oauth";
import { dashboardOverviewAtom } from "@/atoms/dashboard";
import { gettingStartedAtom, inactiveGettingStartedAtom } from "@/atoms/getting-started";
import { gettingStartedStorageKey } from "@/lib/getting-started";

import { useCurrentUser } from "./auth";

const storageOptions = { deserializer: (value: string) => value === "true" };
const noPermissions: readonly MemberPermission[] = [];

export function useGettingStarted() {
  const currentUser = useCurrentUser();
  const actor = currentUser.data;
  const refreshSession = currentUser.refetch;
  const registry = useContext(RegistryContext);
  const [dismissed, setDismissed] = useLocalStorage(
    gettingStartedStorageKey(actor?.user.id ?? "", actor?.organization.id ?? ""),
    false,
    storageOptions,
  );
  const progress = useAtomValue(dismissed ? inactiveGettingStartedAtom : gettingStartedAtom);
  const permissions = actor?.role.permissions ?? noPermissions;
  const count = progress.completed.filter(Boolean).length;
  const canFinish = count === 4 && !progress.isLoading && !progress.isError;

  useEffect(() => {
    if (progress.accessRejected) refreshSession();
  }, [progress.accessRejected, refreshSession]);

  const refresh = useCallback(() => {
    if (dismissed || !progress.available) return;
    registry.refresh(dashboardOverviewAtom);
    if (permissions.includes("api-key:read")) registry.refresh(apiKeysAtom);
    if (permissions.includes("cli-authorization:read")) registry.refresh(cliAuthorizationsAtom);
    if (permissions.includes("mcp-authorization:read")) registry.refresh(mcpAuthorizationsAtom);
  }, [dismissed, permissions, progress.available, registry]);

  const finish = useCallback(() => {
    if (canFinish) setDismissed(true);
  }, [canFinish, setDismissed]);

  return { ...progress, count, canFinish, dismissed, finish, refresh, permissions };
}
