import type { PlatformPermission } from "@namera-ai/protocol/model";

export function hasPermissions(
  granted: ReadonlyArray<PlatformPermission>,
  required: ReadonlyArray<PlatformPermission>,
) {
  return required.every((permission) => granted.includes(permission));
}
