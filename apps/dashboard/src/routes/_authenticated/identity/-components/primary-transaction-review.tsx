// oxlint-disable react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-jsx-as-prop
import type { EvmNativePriceQuote, WalletResponse } from "@namera-ai/protocol/dto";
import { ArrowUpRight01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { formatEther } from "viem";

import {
  ChainDisplay,
  MetadataDisplay,
  NamespaceDisplay,
  WalletOwnerDisplay,
} from "@/components/display";
import { TransactionOverview } from "@/components/transaction-overview";

export function PrimaryTransactionReview({
  wallet,
  contract,
  fee,
  priceQuote,
  sponsored,
  name,
  onConfirm,
  onCancel,
}: {
  wallet: WalletResponse;
  contract: `0x${string}`;
  fee: bigint;
  priceQuote: EvmNativePriceQuote | null;
  sponsored: boolean;
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ethFee = Number(formatEther(fee));
  const usdFee = priceQuote ? ethFee * priceQuote.ethUsd : null;
  const formattedEth =
    ethFee > 0 && ethFee < 0.000001
      ? "<0.000001"
      : ethFee.toLocaleString(undefined, { maximumFractionDigits: 6 });

  return (
    <TransactionOverview
      isOpen
      title="Review transaction"
      description={`Set ${name} as this account’s primary name on Ethereum.`}
      confirmText="Confirm and approve"
      onConfirm={onConfirm}
      onCancel={onCancel}
      rows={[
        {
          id: "namespace",
          key: "Namespace",
          value: <NamespaceDisplay namespace={wallet.namespace} />,
        },
        {
          id: "account",
          key: "Account",
          value: <MetadataDisplay metadata={wallet.metadata} fallbackName="Account" />,
        },
        {
          id: "custody",
          key: "Custody",
          value: (
            <WalletOwnerDisplay
              custody={wallet.owner.custody}
              provider={
                wallet.owner.custody === "namera-managed" ? wallet.owner.provider : undefined
              }
              protectionLevel={
                wallet.owner.custody === "namera-managed" ? wallet.owner.protectionLevel : undefined
              }
            />
          ),
        },
        { id: "network", key: "Network", value: <ChainDisplay chainId="eip155:1" /> },
        {
          id: "contract",
          key: "Contract",
          value: (
            <a
              href={`https://etherscan.io/address/${contract}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm hover:text-accent"
              aria-label="ENS Reverse Registrar on Etherscan (opens in new tab)"
            >
              ENS Reverse Registrar
              <HugeiconsIcon
                icon={ArrowUpRight01Icon}
                className="size-3.5 text-muted"
                aria-hidden
              />
            </a>
          ),
        },
        { id: "function", key: "Function", value: <code>setName(string)</code> },
      ]}
      footer={
        <div className="flex flex-wrap items-start justify-between gap-2 px-1 text-xs text-muted">
          <div className="grid gap-1">
            <span>{sponsored ? "Estimated gas" : "Estimated gas (max)"}</span>
            {sponsored ? <span>Sponsored by Namera</span> : null}
          </div>
          <div className="grid gap-1 text-right tabular-nums">
            <span title={`${formatEther(fee)} ETH`}>{formattedEth} ETH</span>
            <span>
              {usdFee !== null
                ? `≈ ${usdFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                : "USD estimate unavailable"}
            </span>
          </div>
        </div>
      }
    />
  );
}
