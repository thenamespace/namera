import type { Effect } from "effect";

import type {
  EvmDataProviderError,
  EthereumAddress,
  SupportedEvmChainId,
} from "@namera-ai/protocol";
import type { EvmAddressMetadataData } from "@namera-ai/protocol/model";

export interface ResolveEvmAddressMetadataInput {
  readonly chainId: SupportedEvmChainId;
  readonly addresses: ReadonlyArray<EthereumAddress>;
}

export interface SearchEvmAddressMetadataInput {
  readonly chainId: SupportedEvmChainId;
  readonly query: string;
}

export interface EvmAddressMetadataService {
  readonly resolve: (
    input: ResolveEvmAddressMetadataInput,
  ) => Effect.Effect<ReadonlyArray<EvmAddressMetadataData>, EvmDataProviderError>;
  readonly search: (
    input: SearchEvmAddressMetadataInput,
  ) => Effect.Effect<ReadonlyArray<EthereumAddress>, EvmDataProviderError>;
}
