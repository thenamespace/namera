import { Option, Schema } from "effect";
import type { DateTime } from "effect";

import { EthereumAddress, type SupportedEvmChainId } from "@namera-ai/protocol";
import type { AddressMetadataTag, EvmAddressMetadataData } from "@namera-ai/protocol/model";

import type {
  BlockscoutAddress,
  BlockscoutMetadata,
  BlockscoutToken,
} from "../blockscout/schemas.js";

export type MetadataTag = NonNullable<BlockscoutMetadata["addresses"][string]["tags"]>[number];

const nonEmpty = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0 ? null : normalized;
};

const safeIconUrl = (value: string | null | undefined): string | null => {
  const candidate = nonEmpty(value);
  if (candidate === null) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

const decodeAddress = (value: string): EthereumAddress | null =>
  Option.getOrNull(Schema.decodeUnknownOption(EthereumAddress)(value.toLowerCase()));

const tagType = (value: string): AddressMetadataTag["type"] => {
  switch (value.toLowerCase()) {
    case "name":
      return "name";
    case "category":
      return "category";
    case "protocol":
      return "protocol";
    case "note":
      return "note";
    case "classifier":
      return "classifier";
    default:
      return "information";
  }
};

export const normalizeBlockscoutTags = (
  tags: ReadonlyArray<MetadataTag>,
): ReadonlyArray<AddressMetadataTag> =>
  tags.map((tag) => ({ type: tagType(tag.tagType), slug: tag.slug, name: tag.name }));

export const getBlockscoutMetadataTags = (
  metadata: BlockscoutMetadata | null,
  address: EthereumAddress,
): ReadonlyArray<MetadataTag> =>
  Object.entries(metadata?.addresses ?? {}).find(
    ([candidate]) => candidate.toLowerCase() === address.toLowerCase(),
  )?.[1].tags ?? [];

export const hasCredibleBlockscoutTag = (tags: ReadonlyArray<MetadataTag>): boolean =>
  tags.some((tag) => /verified|official|credible/i.test(`${tag.slug} ${tag.name}`));

const tokenStandard = (token: BlockscoutToken): "erc20" | "erc721" | "erc1155" | "other" => {
  switch (token.type?.toUpperCase()) {
    case "ERC-20":
      return "erc20";
    case "ERC-721":
      return "erc721";
    case "ERC-1155":
      return "erc1155";
    default:
      return "other";
  }
};

const tokenDecimals = (token: BlockscoutToken): number | null => {
  if (token.decimals === undefined || token.decimals === null) return null;
  const value = Number(token.decimals);
  return Number.isInteger(value) && value >= 0 && value <= 255 ? value : null;
};

export const normalizeBlockscoutAddress = (input: {
  readonly address: EthereumAddress;
  readonly chainId: SupportedEvmChainId;
  readonly detail: BlockscoutAddress;
  readonly metadata: BlockscoutMetadata | null;
  readonly observedAt: DateTime.Utc;
}): EvmAddressMetadataData => {
  const rawTags = getBlockscoutMetadataTags(input.metadata, input.address);
  const tags = normalizeBlockscoutTags(rawTags);
  const token = input.detail.token ?? null;
  const standard = token === null ? null : tokenStandard(token);
  const implementation = input.detail.implementations?.[0];
  const implementationAddress =
    implementation === undefined ? null : decodeAddress(implementation.address_hash);
  const isScam = input.detail.is_scam === true || input.detail.reputation === "scam";
  const hasCredibleTag = hasCredibleBlockscoutTag(rawTags);
  const reputation = isScam
    ? "scam"
    : hasCredibleTag
      ? "credible"
      : input.detail.reputation === "suspicious"
        ? "suspicious"
        : "neutral";
  const nameTag = rawTags.find((tag) => tagType(tag.tagType) === "name")?.name;
  const displayName =
    nonEmpty(nameTag) ??
    nonEmpty(token?.name) ??
    nonEmpty(input.detail.name) ??
    nonEmpty(input.detail.ens_domain_name);
  const signals: Array<"blockscout" | "metadata-tag" | "token-market"> = ["blockscout"];
  if (rawTags.length > 0) signals.push("metadata-tag");
  if (nonEmpty(token?.exchange_rate) !== null) signals.push("token-market");

  return {
    schemaVersion: 1,
    namespace: "eip155",
    chainId: input.chainId,
    address: input.address,
    kind:
      standard === "erc20"
        ? "fungible-token"
        : standard === "erc721" || standard === "erc1155"
          ? "nft-contract"
          : input.detail.is_contract === true
            ? "contract"
            : "eoa",
    identity: {
      displayName,
      description: null,
      iconUrl: safeIconUrl(token?.icon_url),
    },
    trust: {
      reputation,
      isScam,
      isSourceVerified: input.detail.is_verified ?? null,
      signals,
    },
    tags,
    token:
      token === null
        ? null
        : {
            standard: standard ?? "other",
            name: nonEmpty(token.name),
            symbol: nonEmpty(token.symbol),
            decimals: tokenDecimals(token),
            logoUrl: safeIconUrl(token.icon_url),
          },
    contract:
      input.detail.is_contract === true
        ? {
            name: nonEmpty(input.detail.name),
            proxyType: nonEmpty(input.detail.proxy_type),
            implementationAddress,
            implementationName: nonEmpty(implementation?.name),
          }
        : null,
    provenance: { provider: "blockscout", observedAt: input.observedAt },
  };
};

export const unknownAddressMetadata = (input: {
  readonly address: EthereumAddress;
  readonly chainId: SupportedEvmChainId;
  readonly observedAt: DateTime.Utc;
}): EvmAddressMetadataData => ({
  schemaVersion: 1,
  namespace: "eip155",
  chainId: input.chainId,
  address: input.address,
  kind: "unknown",
  identity: { displayName: null, description: null, iconUrl: null },
  trust: { reputation: "unknown", isScam: false, isSourceVerified: null, signals: [] },
  tags: [],
  token: null,
  contract: null,
  provenance: { provider: "blockscout", observedAt: input.observedAt },
});
