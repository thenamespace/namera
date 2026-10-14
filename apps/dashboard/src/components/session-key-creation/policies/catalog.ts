import {
  ShieldUserIcon,
  FileScriptIcon,
  CoinsSwapIcon,
  Coins01Icon,
  FuelStationIcon,
} from "@namera-ai/ui/icons";

import { evmPolicyDefinitions } from "@/components/policy/evm/data";
import type {
  OnchainPermissionInput,
  OnchainPermissionType,
} from "@/components/policy/evm/onchain/catalog";

export const sessionPolicyCatalog = [
  {
    id: "contract-access",
    name: "Contract access",
    group: "Access",
    description: "Allow contracts and actions.",
    icon: FileScriptIcon,
  },
  {
    id: "erc20-token-transfer",
    name: "Token Spending (Lifetime)",
    group: "Access",
    description: "Limit transfers and approvals.",
    icon: CoinsSwapIcon,
  },
  {
    id: "native-token-transfer",
    name: "Native spending limit",
    group: "Limits",
    description: "Limit native-token spending.",
    icon: Coins01Icon,
  },
  {
    id: "gas-limit",
    name: "Gas budget",
    group: "Limits",
    description: "Limit total transaction fees.",
    icon: FuelStationIcon,
  },
  {
    id: "signature",
    name: "Signatures",
    group: "Advanced",
    description: "Choose allowed messages.",
    icon: evmPolicyDefinitions["evm.signature"].icon,
  },
  {
    id: "root",
    name: "Unrestricted account access",
    group: "Advanced",
    description: "Grant full account authority.",
    icon: ShieldUserIcon,
  },
] as const;

export type PolicyChoice = (typeof sessionPolicyCatalog)[number];

export function policyChoiceFor(type: OnchainPermissionType | "signature") {
  const id =
    type === "functions-on-contract" ||
    type === "functions-on-all-contracts" ||
    type === "account-functions"
      ? "contract-access"
      : type;
  const choice = sessionPolicyCatalog.find((entry) => entry.id === id);
  if (!choice) throw new Error(`No session policy editor for ${type}`);
  return choice;
}

export function policyUnavailableReason(
  choice: PolicyChoice,
  permissions: ReadonlyArray<OnchainPermissionInput>,
  signatures: boolean,
) {
  if (choice.id === "signature") return signatures ? "Already added" : undefined;
  if (permissions.some((permission) => permission.type === "root"))
    return "Unrestricted access is configured";
  if (choice.id === "root" && permissions.length) return "Remove other transaction policies first";
  if (
    choice.id !== "contract-access" &&
    choice.id !== "erc20-token-transfer" &&
    permissions.some((permission) => permission.type === choice.id)
  )
    return "Already added";
  return undefined;
}

export function permissionConflict(
  candidate: OnchainPermissionInput,
  existing: ReadonlyArray<OnchainPermissionInput>,
) {
  if (
    existing.length &&
    (candidate.type === "root" || existing.some((permission) => permission.type === "root"))
  )
    return "Unrestricted access cannot be combined with another transaction policy.";
  const duplicate = existing.some((permission) =>
    "address" in candidate && "address" in permission
      ? candidate.address.toLowerCase() === permission.address.toLowerCase()
      : !("address" in candidate) && permission.type === candidate.type,
  );
  return duplicate
    ? "This target or policy is already configured. Edit the existing policy instead."
    : undefined;
}
