// oxlint-disable react-perf/jsx-no-jsx-as-prop -- The shared card exposes a ReactNode logo slot.
import type { ComponentProps } from "react";

import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import {
  HugeiconsIcon,
  ShieldUserIcon,
  FileScriptIcon,
  CoinsSwapIcon,
  Coins01Icon,
  FuelStationIcon,
} from "@namera-ai/ui/icons";

import { NetworksSummary } from "../networks-summary";
import { SessionPolicyCard } from "../session-policy-card";
import { onchainPermissionCatalog, type OnchainPermissionInput } from "./catalog";
import { OnchainPermissionSummary } from "./summary";

type Props = Pick<
  ComponentProps<typeof SessionPolicyCard>,
  "onEdit" | "onRemove" | "selected" | "disabled" | "editor"
> & {
  permission: OnchainPermissionInput;
  chainIds: readonly SupportedEvmChainId[];
  showNetworks?: boolean;
};

export function OnchainPolicyCard({
  permission,
  chainIds,
  showNetworks = false,
  ...actions
}: Props) {
  const icon =
    permission.type === "erc20-token-transfer"
      ? CoinsSwapIcon
      : permission.type === "native-token-transfer"
        ? Coins01Icon
        : permission.type === "gas-limit"
          ? FuelStationIcon
          : permission.type === "root"
            ? ShieldUserIcon
            : FileScriptIcon;
  return (
    <SessionPolicyCard
      name={onchainPermissionCatalog[permission.type].name}
      logo={<HugeiconsIcon icon={icon} />}
      {...actions}
    >
      <OnchainPermissionSummary permission={permission} chainIds={chainIds} />
      {showNetworks ? (
        <div className="mt-1">
          <NetworksSummary chainIds={chainIds} />
        </div>
      ) : null}
    </SessionPolicyCard>
  );
}
