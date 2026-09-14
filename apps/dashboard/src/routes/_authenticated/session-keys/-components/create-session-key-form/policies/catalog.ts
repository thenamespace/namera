import { ShieldUserIcon } from "@namera-ai/ui/icons";

import { evmPolicyCatalog, type EvmPolicyType } from "@/components/policy/evm";
import {
  onchainPermissionCatalog,
  type OnchainPermissionType,
  type OnchainPermissionInput,
} from "@/components/policy/evm/onchain/catalog";

export type Enforcement = "onchain" | "offchain";
export type OnchainPolicyType = OnchainPermissionType | "time-window" | "signature";
export type PolicyChoice = {
  id: string;
  name: string;
  description: string;
  icon: (typeof evmPolicyCatalog)[number]["icon"];
  api?: EvmPolicyType;
  onchain?: OnchainPolicyType | undefined;
};

const overlappingPermissions = new Set<OnchainPolicyType>(
  evmPolicyCatalog.flatMap((definition) => ("onchain" in definition ? [definition.onchain] : [])),
);

export const sessionPolicyCatalog: ReadonlyArray<PolicyChoice> = [
  ...evmPolicyCatalog.map((definition) => ({
    id: definition.type,
    name: definition.name,
    description: definition.description,
    icon: definition.icon,
    api: definition.type,
    onchain: "onchain" in definition ? definition.onchain : undefined,
  })),
  ...Object.entries(onchainPermissionCatalog)
    .filter(([type]) => !overlappingPermissions.has(type as OnchainPolicyType))
    .map(([type, definition]) => ({
      id: type,
      name: definition.name,
      description: definition.description,
      icon: ShieldUserIcon,
      onchain: type as OnchainPermissionType,
    })),
];

export function isOnchainChoiceUnavailable(
  type: OnchainPolicyType,
  existing: ReadonlyArray<OnchainPermissionType>,
  signatures: boolean,
) {
  if (type === "time-window") return false;
  if (type === "signature") return signatures;
  if (existing.includes("root")) return true;
  if (type === "root") return existing.length > 0;
  return (
    !["contract-access", "functions-on-contract", "erc20-token-transfer"].includes(type) &&
    existing.includes(type)
  );
}

export function permissionConflict(
  candidate: OnchainPermissionInput,
  existing: ReadonlyArray<OnchainPermissionInput>,
) {
  if (
    existing.length &&
    (candidate.type === "root" || existing.some((permission) => permission.type === "root"))
  )
    return "Unrestricted access cannot be combined with another onchain permission.";
  const duplicate = existing.some((permission) =>
    "address" in candidate && "address" in permission
      ? candidate.address.toLowerCase() === permission.address.toLowerCase()
      : !("address" in candidate) && permission.type === candidate.type,
  );
  return duplicate
    ? "This target or permission is already configured. Edit the existing policy instead."
    : undefined;
}

export function policyDescription(choice: PolicyChoice, enforcement: Enforcement) {
  if (enforcement === "offchain" || !choice.onchain) return choice.description;
  if (choice.onchain === "time-window") return "Set the start and expiry for onchain executions.";
  if (choice.onchain === "signature")
    return "Allow message and typed-data signatures outside Namera as well.";
  return onchainPermissionCatalog[choice.onchain].description;
}
