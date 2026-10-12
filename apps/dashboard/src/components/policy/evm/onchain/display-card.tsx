// oxlint-disable react-perf/jsx-no-jsx-as-prop -- The shared card exposes a ReactNode logo slot.
import type { ComponentProps } from "react";

import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { HugeiconsIcon, ShieldUserIcon } from "@namera-ai/ui/icons";

import { evmPolicyDefinitions } from "../data";
import { SessionPolicyCard } from "../session-policy-card";
import { onchainPermissionCatalog, type OnchainPermissionInput } from "./catalog";
import { OnchainPermissionSummary } from "./summary";

type Props = Pick<
  ComponentProps<typeof SessionPolicyCard>,
  "onEdit" | "onRemove" | "selected" | "disabled" | "editor"
> & {
  permission: OnchainPermissionInput;
  chainIds: readonly SupportedEvmChainId[];
};

export function OnchainPolicyCard({ permission, chainIds, ...actions }: Props) {
  const icon =
    permission.type === "erc20-token-transfer"
      ? evmPolicyDefinitions["evm.erc20-token-transfer"].icon
      : permission.type === "native-token-transfer"
        ? evmPolicyDefinitions["evm.native-spend-limit"].icon
        : permission.type === "gas-limit"
          ? evmPolicyDefinitions["evm.gas-budget"].icon
          : permission.type === "root"
            ? ShieldUserIcon
            : evmPolicyDefinitions["evm.contract-access"].icon;
  return (
    <SessionPolicyCard
      name={onchainPermissionCatalog[permission.type].name}
      logo={<HugeiconsIcon icon={icon} />}
      {...actions}
    >
      <OnchainPermissionSummary permission={permission} chainIds={chainIds} />
    </SessionPolicyCard>
  );
}
