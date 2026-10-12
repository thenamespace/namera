import { EthereumAddress, type SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { formatUnits } from "viem";

import { EvmAddressDisplay } from "@/components/display/evm-address-display";
import { TokenDisplay } from "@/components/display/token-display";

import type { OnchainPermissionInput } from "./catalog";

export function OnchainPermissionSummary({
  permission,
  chainIds,
}: {
  permission: OnchainPermissionInput;
  chainIds?: readonly SupportedEvmChainId[];
}) {
  if (permission.type === "contract-access" || permission.type === "functions-on-contract") {
    const label =
      permission.type === "contract-access"
        ? "All functions"
        : `${permission.functions.length} ${permission.functions.length === 1 ? "function" : "functions"} selected`;
    const networks = chainIds?.length ? chainIds : [undefined];
    return (
      <span className="grid gap-1">
        {networks.map((chainId) => (
          <span
            key={chainId ?? "address"}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4"
          >
            <EvmAddressDisplay
              address={EthereumAddress.make(permission.address)}
              {...(chainId ? { chainId } : {})}
              size="sm"
            />
            <span>{label}</span>
          </span>
        ))}
      </span>
    );
  }
  if (permission.type === "erc20-token-transfer" && chainIds?.length) {
    return (
      <span className="grid gap-1">
        {chainIds.map((chainId) => (
          <TokenDisplay
            size="sm"
            key={chainId}
            namespace="eip155"
            chainId={chainId}
            address={EthereumAddress.make(permission.address)}
            amount={permission.allowance}
          />
        ))}
      </span>
    );
  }
  return (
    <span className="grid gap-1">
      {"address" in permission ? (
        chainIds?.length ? (
          chainIds.map((chainId) => (
            <EvmAddressDisplay
              key={chainId}
              address={EthereumAddress.make(permission.address)}
              chainId={chainId}
            />
          ))
        ) : (
          <EvmAddressDisplay address={EthereumAddress.make(permission.address)} />
        )
      ) : null}
      {"functions" in permission ? (
        <span>
          {permission.functions.length}{" "}
          {permission.functions.length === 1 ? "function" : "functions"} selected
          {permission.type === "functions-on-all-contracts" ? " · Any contract" : ""}
        </span>
      ) : null}
      {permission.type === "erc20-token-transfer" ? (
        <span>{permission.allowance} token base units · Lifetime per network</span>
      ) : null}
      {permission.type === "native-token-transfer" || permission.type === "gas-limit" ? (
        <span>
          {formatUnits(
            BigInt(permission.type === "gas-limit" ? permission.limit : permission.allowance),
            18,
          )}{" "}
          native tokens · Lifetime per network
        </span>
      ) : null}
      {permission.type === "root" ? (
        <span className="text-danger">Full account authority, including permission management</span>
      ) : null}
    </span>
  );
}
