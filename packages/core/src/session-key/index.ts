import type { PermissionAccountParams } from "@zerodev/permissions";

export * from "./ecdsa";

export const deserializePermissionAccountParams = (params: string) => {
  const uint8Array = base64ToBytes(params);
  const jsonString = new TextDecoder().decode(uint8Array);
  return JSON.parse(jsonString) as PermissionAccountParams;
};
