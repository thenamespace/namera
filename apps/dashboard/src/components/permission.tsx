import type { ReactNode } from "react";

import type { MemberPermission } from "@namera-ai/protocol/model";

import { useCurrentUser } from "@/hooks/auth";

export function hasPermissions(
  granted: ReadonlyArray<MemberPermission>,
  required: ReadonlyArray<MemberPermission>,
) {
  return required.every((permission) => granted.includes(permission));
}

type PermissionGuardProps = {
  required: ReadonlyArray<MemberPermission>;
  children: ReactNode;
  fallback?: ReactNode;
};

export function PermissionGuard({ required, children, fallback = null }: PermissionGuardProps) {
  const currentUser = useCurrentUser();
  return hasPermissions(currentUser.data?.role.permissions ?? [], required) ? children : fallback;
}
