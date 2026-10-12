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
  if (permission.type === "erc20-token-transfer" && chainIds?.length) {
    return (
      <span className="grid gap-1">
        {chainIds.map((chainId) => (
          <TokenDisplay
            key={chainId}
            namespace="eip155"
            chainId={chainId}
            address={EthereumAddress.make(permission.address)}
            amount={permission.allowance}
          />
        ))}
        <span>Lifetime allowance per network</span>
      </span>
    );
  }
  return (
    <span className="grid gap-1">
      {"address" in permission ? (
        <EvmAddressDisplay address={EthereumAddress.make(permission.address)} />
      ) : null}
      {permission.type === "contract-access" ? <span>All functions on this contract</span> : null}
      {permission.type === "functions-on-contract" ? (
        <span>Selected functions on this contract</span>
      ) : null}
      {permission.type === "functions-on-all-contracts" ? (
        <span>Selected functions on any contract</span>
      ) : null}
      {"functions" in permission ? (
        <span className="break-all font-mono text-xs">{permission.functions.join(", ")}</span>
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
