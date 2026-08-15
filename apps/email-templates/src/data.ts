import type { EvmChainName } from "@namera-ai/protocol/evm";

export const emailAssetCdnBaseUrl = "https://cdn.namera.ai/email-assets";

const emailAssetUrl = (path: string) => `${emailAssetCdnBaseUrl}/${path}`;

export const emailAssets = {
  brand: {
    light: emailAssetUrl("brand/namera-light.png"),
    dark: emailAssetUrl("brand/namera-dark.png"),
  },
  chains: {
    arbitrum: emailAssetUrl("chains/arbitrum.png"),
    arc: emailAssetUrl("chains/arc.png"),
    avalanche: emailAssetUrl("chains/avalanche.png"),
    base: emailAssetUrl("chains/base.png"),
    celo: emailAssetUrl("chains/celo.png"),
    ethereum: emailAssetUrl("chains/ethereum.png"),
    "hyper-evm": emailAssetUrl("chains/hyper-evm.png"),
    megaeth: emailAssetUrl("chains/megaeth.png"),
    monad: emailAssetUrl("chains/monad.png"),
    optimism: emailAssetUrl("chains/optimism.png"),
    polygon: emailAssetUrl("chains/polygon.png"),
    scroll: emailAssetUrl("chains/scroll.png"),
    tempo: emailAssetUrl("chains/tempo.png"),
    unichain: emailAssetUrl("chains/unichain.png"),
  } satisfies Readonly<Record<EvmChainName, string>>,
  social: {
    website: {
      light: emailAssetUrl("social/website-light.png"),
      dark: emailAssetUrl("social/website-dark.png"),
    },
    github: {
      light: emailAssetUrl("social/github-light.png"),
      dark: emailAssetUrl("social/github-dark.png"),
    },
    email: {
      light: emailAssetUrl("social/email-light.png"),
      dark: emailAssetUrl("social/email-dark.png"),
    },
    linkedin: {
      light: emailAssetUrl("social/linkedin-light.png"),
      dark: emailAssetUrl("social/linkedin-dark.png"),
    },
  },
} as const;

export const emailLinks = {
  website: {
    label: "Website",
    href: "https://example.com/?source=namera-website", // TODO: Update
  },
  github: {
    label: "GitHub",
    href: "https://example.com/?source=namera-github", // TODO: Update
  },
  email: {
    label: "Email",
    href: "mailto:hello@example.com", // TODO: Update
  },
  linkedin: {
    label: "LinkedIn",
    href: "https://example.com/?source=namera-linkedin", // TODO: Update
  },
} as const;
