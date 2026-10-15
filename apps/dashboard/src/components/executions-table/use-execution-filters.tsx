import { useMemo, useState } from "react";

import { chains as supportedEvmChains, getChainDataByCaip2 } from "@namera-ai/evm/chains";
import type { ExecutionListItemResponse } from "@namera-ai/protocol/dto";
import type { ActorType } from "@namera-ai/protocol/model";
import {
  BotIcon,
  ChainIcon,
  HugeiconsIcon,
  Key01Icon,
  Layers01Icon,
  Wallet01Icon,
} from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import {
  countTableValues,
  toTableSelection,
  type TableFilterFacet,
} from "@/components/common/table";
import {
  ChainDisplay,
  ExecutionActorDisplay,
  MetadataDisplay,
  NamespaceDisplay,
  actorDisplay,
} from "@/components/display";
import { useSessionKeys } from "@/hooks/session-key";
import { useWallets } from "@/hooks/wallet";

import { getActorLabel, getExecutionChain } from "./data";

export type ExecutionTableScope = "organization" | "wallet" | "session-key";

export function useExecutionFilters(
  items: ReadonlyArray<ExecutionListItemResponse>,
  scope: ExecutionTableScope,
) {
  const wallets = useWallets();
  const organizationSessionKeys = useSessionKeys();
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState<ReadonlySet<string>>(new Set());
  const [namespaces, setNamespaces] = useState<ReadonlySet<string>>(new Set());
  const [chains, setChains] = useState<ReadonlySet<string>>(new Set());
  const [sessionKeys, setSessionKeys] = useState<ReadonlySet<string>>(new Set());
  const [actors, setActors] = useState<ReadonlySet<string>>(new Set());
  const normalizedQuery = query.trim().toLowerCase();

  const accountOptions = useMemo(() => {
    const counts = countTableValues(items, (item) => item.wallet.id);
    const available = new Map<
      ExecutionListItemResponse["wallet"]["id"],
      Pick<ExecutionListItemResponse["wallet"], "id" | "metadata">
    >();
    for (const wallet of wallets.data ?? []) available.set(wallet.id, wallet);
    for (const item of items) available.set(item.wallet.id, item.wallet);

    return [...available.values()].map((wallet) => ({
      id: wallet.id,
      label: wallet.metadata.name,
      content: <MetadataDisplay fallbackName="Unnamed account" metadata={wallet.metadata} />,
      count: counts.get(wallet.id) ?? 0,
    }));
  }, [items, wallets.data]);
  const namespaceOptions = useMemo(() => {
    const counts = countTableValues(items, (item) => item.details.namespace);
    const availableNamespaces = new Set<ExecutionListItemResponse["details"]["namespace"]>([
      "eip155",
      ...counts.keys(),
    ]);
    return [...availableNamespaces].map((namespace) => ({
      id: namespace,
      label: namespace,
      content: <NamespaceDisplay namespace={namespace} />,
      count: counts.get(namespace) ?? 0,
    }));
  }, [items]);
  const chainOptions = useMemo(() => {
    const counts = countTableValues(items, (item) => item.details.chainId);
    const available = new Map(
      Object.values(supportedEvmChains).map((chain) => [chain.chainId, chain.chain.name] as const),
    );
    for (const item of items) {
      available.set(
        item.details.chainId,
        getExecutionChain(item)?.chain.name ?? item.details.chainId,
      );
    }

    return [...available].map(([chainId, label]) => ({
      group: getChainDataByCaip2(chainId)?.chain.testnet ? "Testnets" : "Mainnets",
      id: chainId,
      label,
      content: <ChainDisplay chainId={chainId} />,
      count: counts.get(chainId) ?? 0,
    }));
  }, [items]);
  const sessionKeyOptions = useMemo(() => {
    const counts = countTableValues(items, (item) => item.sessionKey.id);
    const available = new Map<
      ExecutionListItemResponse["sessionKey"]["id"],
      Pick<ExecutionListItemResponse["sessionKey"], "id" | "metadata">
    >();
    for (const sessionKey of organizationSessionKeys.data ?? []) {
      available.set(sessionKey.id, sessionKey);
    }
    for (const item of items) available.set(item.sessionKey.id, item.sessionKey);

    return [...available.values()].map((sessionKey) => ({
      id: sessionKey.id,
      label: sessionKey.metadata.name,
      content: (
        <MetadataDisplay fallbackName="Unnamed session key" metadata={sessionKey.metadata} />
      ),
      count: counts.get(sessionKey.id) ?? 0,
    }));
  }, [items, organizationSessionKeys.data]);
  const actorOptions = useMemo(() => {
    const counts = countTableValues(items, (item) => item.actorType);
    return (Object.entries(actorDisplay) as ReadonlyArray<[ActorType, { label: string }]>).map(
      ([type, display]) => ({
        id: type,
        label: display.label,
        content: <ExecutionActorDisplay type={type} />,
        count: counts.get(type) ?? 0,
      }),
    );
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const chain = getExecutionChain(item);
        const matchesQuery =
          normalizedQuery.length === 0 ||
          [
            item.details.id,
            item.details.namespace,
            item.details.chainId,
            chain?.chain.name,
            item.details.transactionHash,
            item.wallet.id,
            item.wallet.address,
            item.wallet.metadata.name,
            item.sessionKey.id,
            item.sessionKey.metadata.name,
            getActorLabel(item),
          ].some((value) => value?.toLowerCase().includes(normalizedQuery));

        return (
          matchesQuery &&
          (accounts.size === 0 || accounts.has(item.wallet.id)) &&
          (namespaces.size === 0 || namespaces.has(item.details.namespace)) &&
          (chains.size === 0 || chains.has(item.details.chainId)) &&
          (sessionKeys.size === 0 || sessionKeys.has(item.sessionKey.id)) &&
          (actors.size === 0 || actors.has(item.actorType))
        );
      }),
    [accounts, actors, chains, items, namespaces, normalizedQuery, sessionKeys],
  );
  const facets = useMemo<ReadonlyArray<TableFilterFacet>>(() => {
    const availableFacets: TableFilterFacet[] = [];

    if (scope === "organization") {
      availableFacets.push({
        id: "account",
        label: "Account",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Wallet01Icon} />,
        selectedKeys: accounts,
        options: accountOptions,
        emptyLabel: "No accounts",
        onSelectionChange: (keys) =>
          setAccounts(
            toTableSelection(
              keys,
              accountOptions.map((option) => option.id),
            ),
          ),
      });
    }

    if (scope !== "session-key") {
      availableFacets.push({
        id: "session-key",
        label: "Session key",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Key01Icon} />,
        selectedKeys: sessionKeys,
        options: sessionKeyOptions,
        emptyLabel: "No session keys",
        onSelectionChange: (keys) =>
          setSessionKeys(
            toTableSelection(
              keys,
              sessionKeyOptions.map((option) => option.id),
            ),
          ),
      });
    }

    availableFacets.push(
      {
        id: "namespace",
        label: "Namespace",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Layers01Icon} />,
        selectedKeys: namespaces,
        options: namespaceOptions,
        onSelectionChange: (keys) =>
          setNamespaces(
            toTableSelection(
              keys,
              namespaceOptions.map((option) => option.id),
            ),
          ),
      },
      {
        id: "chain",
        label: "Chain",
        icon: <ChainIcon className="size-4" chain="ethereum" namespace="eip155" />,
        selectedKeys: chains,
        options: chainOptions,
        groups: ["Mainnets", "Testnets"],
        onSelectionChange: (keys) =>
          setChains(
            toTableSelection(
              keys,
              chainOptions.map((option) => option.id),
            ),
          ),
      },
      {
        id: "actor",
        label: "Called by",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={BotIcon} />,
        selectedKeys: actors,
        options: actorOptions,
        onSelectionChange: (keys) =>
          setActors(
            toTableSelection(
              keys,
              actorOptions.map((option) => option.id),
            ),
          ),
      },
    );

    return availableFacets;
  }, [
    accountOptions,
    accounts,
    actorOptions,
    actors,
    chainOptions,
    chains,
    namespaceOptions,
    namespaces,
    sessionKeyOptions,
    sessionKeys,
    scope,
  ]);
  const hasFilters =
    normalizedQuery.length > 0 ||
    accounts.size > 0 ||
    namespaces.size > 0 ||
    chains.size > 0 ||
    sessionKeys.size > 0 ||
    actors.size > 0;
  const clearFilters = useEventCallback(() => {
    setQuery("");
    setAccounts(new Set());
    setNamespaces(new Set());
    setChains(new Set());
    setSessionKeys(new Set());
    setActors(new Set());
  });

  return { query, setQuery, filtered, facets, hasFilters, clearFilters };
}
