import type { EnsLabel } from "@namera-ai/protocol";

export const ensPolicy = {
  parentName: "namera.eth",
} as const;

export const toEnsName = (label: EnsLabel) => `${label}.${ensPolicy.parentName}`;
