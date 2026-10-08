import type { ReactNode } from "react";

import type { PlatformPermission } from "@namera-ai/protocol/model";

import { currentAdminAtom } from "@/atoms/auth";
import { toQuery } from "@/hooks/atom";

const useCurrentAdmin = toQuery(() => currentAdminAtom);

export function hasPermissions(
  granted: ReadonlyArray<PlatformPermission>,
  required: ReadonlyArray<PlatformPermission>,
) {
  return required.every((permission) => granted.includes(permission));
}

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
