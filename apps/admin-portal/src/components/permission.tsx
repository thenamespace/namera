import type { ReactNode } from "react";

import type { PlatformPermission } from "@namera-ai/protocol/model";

import { currentAdminAtom } from "@/atoms/auth";
import { toQuery } from "@/hooks/atom";
import { hasPermissions } from "@/lib/permissions";

export { hasPermissions } from "@/lib/permissions";

const useCurrentAdmin = toQuery(() => currentAdminAtom);

export function usePermissions() {
  const { data } = useCurrentAdmin();
  return data?.status === "authorized" ? data.admin.permissions : [];
}

export function PermissionGuard({
  required,
  children,
  fallback = null,
}: {
  required: ReadonlyArray<PlatformPermission>;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return hasPermissions(usePermissions(), required) ? children : fallback;
}

export const manageTeamPermission = ["team:manage"] as const;
export const readFeedbackPermission = ["feedback:read"] as const;
export const manageFeedbackPermission = ["feedback:manage"] as const;
export const readTeamPermission = ["team:read"] as const;
export const readCatalogPermission = ["catalog:read"] as const;
export const manageCatalogPermission = ["catalog:manage"] as const;
export const readOverviewPermission = ["overview:read"] as const;
export const readInvitesPermission = ["invites:read"] as const;
export const manageInvitesPermission = ["invites:manage"] as const;
export const readWaitlistPermission = ["waitlist:read"] as const;
export const acceptWaitlistPermission = ["waitlist:accept"] as const;
