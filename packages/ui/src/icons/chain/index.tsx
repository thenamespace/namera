import { ScrollIcon } from "@phosphor-icons/react";

import { SupportedChain } from "@namera-ai/schema";

import { ArbitrumIcon } from "./arbitrum";
import { ArcIcon } from "./arc";
import { AvalancheIcon } from "./avalanche";
import { BaseIcon } from "./base";
import { CeloIcon } from "./celo";
import { EthereumIcon } from "./ethereum";
import { GnosisIcon } from "./gnosis";
import { HyperevmIcon } from "./hyperevm";
import { LineaIcon } from "./linea";
import { MegaethIcon } from "./megaeth";
import { MonadIcon } from "./monad";
import { OptimismIcon } from "./optimism";
import { PolygonIcon } from "./polygon";
import { TempoIcon } from "./tempo";
import { UnichainIcon } from "./unichain";
type ChainIconProps = React.SVGProps<SVGSVGElement> & {
  chain: SupportedChain;
};

export const ChainIcon = ({ chain, ...props }: ChainIconProps) => {
  if (chain === "eth-mainnet" || chain === "eth-sepolia") {
    return <EthereumIcon {...props} />;
  } else if (chain === "arb-mainnet" || chain === "arb-sepolia") {
    return <ArbitrumIcon {...props} />;
  } else if (chain === "base-mainnet" || chain === "base-sepolia") {
    return <BaseIcon {...props} />;
  } else if (chain === "arc-testnet") {
    return <ArcIcon {...props} />;
  } else if (chain === "avax-mainnet" || chain === "avax-fuji") {
    return <AvalancheIcon {...props} />;
  } else if (chain === "celo-mainnet") {
    return <CeloIcon {...props} />;
  } else if (chain === "scroll-mainnet" || chain === "scroll-sepolia") {
    return <ScrollIcon {...props} />;
  } else if (chain === "monad-mainnet" || chain === "monad-testnet") {
    return <MonadIcon {...props} />;
  } else if (chain === "megaeth-mainnet" || chain === "megaeth-testnet") {
    return <MegaethIcon {...props} />;
  } else if (chain === "hyperevm-mainnet") {
    return <HyperevmIcon {...props} />;
  } else if (chain === "linea-mainnet" || chain === "linea-sepolia") {
    return <LineaIcon {...props} />;
  } else if (chain === "opt-mainnet" || chain === "opt-sepolia") {
    return <OptimismIcon {...props} />;
  } else if (chain === "gnosis-mainnet" || chain === "gnosis-chiado") {
    return <GnosisIcon {...props} />;
  } else if (chain === "polygon-amoy" || chain === "polygon-mainnet") {
    return <PolygonIcon {...props} />;
  } else if (chain === "tempo-mainnet" || chain === "tempo-moderato") {
    return <TempoIcon {...props} />;
  } else if (chain === "unichain-mainnet" || chain === "unichain-sepolia") {
    return <UnichainIcon {...props} />;
  }

  return null;
};
