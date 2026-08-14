import type { ComponentType, SVGProps } from "react";

import type { EvmChainName } from "@namera-ai/protocol/evm";

import { ChainArbitrumIcon } from "./chain/arbitrum.js";
import { ChainArcIcon } from "./chain/arc.js";
import { ChainAvalancheIcon } from "./chain/avalanche.js";
import { ChainBaseIcon } from "./chain/base.js";
import { ChainCeloIcon } from "./chain/celo.js";
import { ChainEthereumIcon } from "./chain/ethereum.js";
import { ChainHyperEvmIcon } from "./chain/hyperevm.js";
import { ChainMegaEthIcon } from "./chain/megaeth.js";
import { ChainMonadIcon } from "./chain/monad.js";
import { ChainOptimismIcon } from "./chain/optimism.js";
import { ChainPolygonIcon } from "./chain/polygon.js";
import { ChainScrollIcon } from "./chain/scroll.js";
import { ChainTempoIcon } from "./chain/tempo.js";
import { ChainUnichainIcon } from "./chain/unichain.js";

type SvgIcon = ComponentType<SVGProps<SVGSVGElement>>;

const evmChainIcons: Readonly<Record<EvmChainName, SvgIcon>> = {
  arbitrum: ChainArbitrumIcon,
  arc: ChainArcIcon,
  avalanche: ChainAvalancheIcon,
  base: ChainBaseIcon,
  celo: ChainCeloIcon,
  ethereum: ChainEthereumIcon,
  "hyper-evm": ChainHyperEvmIcon,
  megaeth: ChainMegaEthIcon,
  monad: ChainMonadIcon,
  optimism: ChainOptimismIcon,
  polygon: ChainPolygonIcon,
  scroll: ChainScrollIcon,
  tempo: ChainTempoIcon,
  unichain: ChainUnichainIcon,
};

export type ChainIconProps = SVGProps<SVGSVGElement> & {
  readonly namespace: "eip155";
  readonly chain: EvmChainName;
};

export const ChainIcon = ({ namespace, chain, ...props }: ChainIconProps) => {
  switch (namespace) {
    case "eip155": {
      const Icon = evmChainIcons[chain];
      return <Icon {...props} />;
    }
  }
};
