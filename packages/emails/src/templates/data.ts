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
    base: emailAssetUrl("chains/base.png"),
    ethereum: emailAssetUrl("chains/ethereum.png"),
    optimism: emailAssetUrl("chains/optimism.png"),
  } satisfies Readonly<Record<EvmChainName, string>>,
  social: {
    x: {
      light: emailAssetUrl("social/x-light.png"),
      dark: emailAssetUrl("social/x-dark.png"),
    },
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
  x: {
    label: "X (Twitter)",
    href: "https://x.com/namera_ai",
  },
  website: {
    label: "Website",
    href: "https://namera.ai",
  },
  github: {
    label: "GitHub",
    href: "https://github.com/thenamespace/namera",
  },
  email: {
    label: "Email",
    href: "mailto:hey@namera.ai",
  },
  linkedin: {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/namera-ai",
  },
} as const;
