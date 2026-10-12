import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react";

import type { EthereumAddress, SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { Avatar, Button, Skeleton, Tooltip } from "@namera-ai/ui";
import { ChainIcon, HugeiconsIcon, InformationCircleIcon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";
import { useEnsAvatar, useEnsName } from "wagmi";
import { mainnet } from "wagmi/chains";

import { useCatalogAddress } from "@/hooks/catalog";
import { copyTextWithFeedback } from "@/lib/clipboard";

import { chainDataById } from "./chain-display";

type EvmAddressDisplayProps = {
  address: EthereumAddress;
  chainId?: SupportedEvmChainId;
  size?: "sm" | "md";
};

export function EvmAddressDisplay({ address, chainId, size = "md" }: EvmAddressDisplayProps) {
  return chainId ? (
    <CatalogAddressDisplay address={address} chainId={chainId} size={size} />
  ) : (
    <EnsAddressDisplay address={address} size={size} />
  );
}

function CatalogAddressDisplay({
  address,
  chainId,
  size,
}: {
  address: EthereumAddress;
  chainId: SupportedEvmChainId;
  size: "sm" | "md";
}) {
  const query = useCatalogAddress({ namespace: "eip155", chainId, address });
  const metadata = query.data?.catalog.data;
  const network = chainDataById.get(chainId);

  if (query.isPending)
    return (
      <output
        className={
          size === "sm"
            ? "inline-flex h-4 items-center gap-1"
            : "inline-flex h-7 items-center gap-2"
        }
        aria-label="Loading address"
      >
        <Skeleton className={size === "sm" ? "size-3 rounded-full" : "size-6 rounded-full"} />
        <Skeleton className="h-3 w-24 rounded" />
      </output>
    );

  if (!metadata)
    return (
      <span className="inline-flex items-center gap-2">
        <EnsAddressDisplay address={address} size={size} />
        {query.isError ? (
          <Button
            size="sm"
            variant="ghost"
            onPress={query.refetch}
            aria-label="Retry address metadata"
          >
            Retry
          </Button>
        ) : null}
      </span>
    );

  return (
    <CopyableAddress address={address} size={size}>
      <span className="relative shrink-0">
        <Avatar className={size === "sm" ? "size-3" : "size-6"}>
          <Avatar.Image src={`https://cdn.namera.ai/${metadata.display.logo}`} alt="" />
          <Avatar.Fallback>{metadata.display.name.slice(0, 2)}</Avatar.Fallback>
        </Avatar>
        {network ? (
          <ChainIcon
            namespace="eip155"
            chain={network.name}
            aria-hidden
            className={`bg-surface absolute -right-0.5 -bottom-0.5 rounded-full ring-1 ring-surface ${size === "sm" ? "size-1.5" : "size-2.5"}`}
          />
        ) : null}
      </span>
      <span
        className={`text-foreground min-w-0 truncate ${size === "sm" ? "text-[11px] leading-4" : "text-xs font-medium"}`}
      >
        {metadata.display.name}
      </span>
      <HugeiconsIcon
        icon={InformationCircleIcon}
        className={size === "sm" ? "size-3 shrink-0" : "size-3.5 shrink-0"}
        aria-hidden
      />
    </CopyableAddress>
  );
}

function EnsAddressDisplay({ address, size }: Pick<EvmAddressDisplayProps, "address" | "size">) {
  const { data: ensName } = useEnsName({
    address,
    chainId: mainnet.id,
    query: { staleTime: 60 * 60 * 1000 },
  });

  const { data: ensAvatar } = useEnsAvatar({
    chainId: mainnet.id,
    name: ensName ?? undefined,
    query: {
      enabled: ensName !== null && ensName !== undefined,
      staleTime: 60 * 60 * 1000,
    },
  });

  const placeholderAvatar = `https://api.dicebear.com/10.x/glass/svg?seed=${address}&size=40`;

  return (
    <CopyableAddress address={address} size={size}>
      {ensName ? (
        <>
          <Avatar className={size === "sm" ? "size-3 shrink-0" : "size-4.5 shrink-0"}>
            <Avatar.Image alt="" src={ensAvatar ?? placeholderAvatar} />
          </Avatar>
          <span className={size === "sm" ? "truncate text-[11px] leading-4" : "truncate text-xs"}>
            {ensName}
          </span>
        </>
      ) : (
        <span className={size === "sm" ? "font-mono text-[11px] leading-4" : "font-mono text-xs"}>
          {address.slice(0, 8)}…{address.slice(-6)}
        </span>
      )}
    </CopyableAddress>
  );
}

function CopyableAddress({
  address,
  children,
  size,
}: {
  address: EthereumAddress;
  children: ReactNode;
  size?: "sm" | "md" | undefined;
}) {
  const copyAddress = useEventCallback(() => {
    void copyTextWithFeedback(address, {
      success: { title: "Address copied to clipboard" },
      error: { title: "Couldn't copy address" },
    });
  });

  const handleKeyDown = useEventCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    copyAddress();
  });
  const handlePointerDown = useEventCallback((event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
  });
  const handleClick = useEventCallback((event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    copyAddress();
  });

  return (
    <Tooltip delay={300} shouldCloseOnPress={false}>
      <Tooltip.Trigger
        aria-label={`Copy address ${address}`}
        className={`text-muted hover:text-foreground inline-flex min-w-0 cursor-copy items-center transition-colors ${size === "sm" ? "gap-1" : "gap-2"}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Content className="max-w-none whitespace-nowrap font-mono text-xs" showArrow>
        <Tooltip.Arrow />
        {address}
      </Tooltip.Content>
    </Tooltip>
  );
}

export type { EvmAddressDisplayProps };
