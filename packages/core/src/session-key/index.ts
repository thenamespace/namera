import type { PermissionAccountParams } from "@zerodev/permissions";

export * from "./ecdsa";
export * from "./status";

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0) as number);
}

export const deserializePermissionAccountParams = (params: string) => {
  const uint8Array = base64ToBytes(params);
  const jsonString = new TextDecoder().decode(uint8Array);
  return JSON.parse(jsonString) as PermissionAccountParams;
};
