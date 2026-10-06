export const dashboardSite = {
  name: "Namera Dashboard",
  origin: "https://dashboard.namera.ai",
  publicPath: "/auth",
  title: "Namera Dashboard | Agent Wallets & Permissions",
  description:
    "Manage your Namera accounts, session keys, spending limits, and agent access. Review onchain activity and control what your agents can do.",
  keywords:
    "Namera, agent wallets, programmable wallets, smart accounts, session keys, wallet permissions, spending limits",
  image: "https://cdn.namera.ai/seo/og.png",
  imageAlt: "Namera logo and wordmark on a dark charcoal gradient",
  twitter: "@namera_ai",
} as const;

export const publicRobots = "index, follow, max-image-preview:large";
export const privateRobots = "noindex, nofollow, noarchive";

export type PageSeo = {
  readonly title: string;
  readonly description: string;
  readonly indexable?: boolean;
};

export const defaultSeo: PageSeo = {
  title: dashboardSite.title,
  description: dashboardSite.description,
};

export const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": `${dashboardSite.origin}/#application`,
  name: dashboardSite.name,
  url: `${dashboardSite.origin}${dashboardSite.publicPath}`,
  description: dashboardSite.description,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  browserRequirements: "Requires JavaScript and a modern browser with passkey support.",
  inLanguage: "en",
  image: dashboardSite.image,
  publisher: {
    "@type": "Organization",
    name: "Namera",
    url: "https://namera.ai",
    logo: "https://cdn.namera.ai/seo/icon-512.png",
  },
};

// Only public, code-owned text belongs here. Never serialize router search,
// resource identifiers, account names, or credentials into social metadata.
export function pageMetadata(page: PageSeo) {
  const title = page.title;
  return {
    title,
    meta: {
      description: page.description,
      keywords: dashboardSite.keywords,
      robots: page.indexable ? publicRobots : privateRobots,
      "og:site_name": dashboardSite.name,
      "og:type": "website",
      "og:locale": "en_US",
      "og:title": title,
      "og:description": page.description,
      "og:url": `${dashboardSite.origin}${dashboardSite.publicPath}`,
      "og:image": dashboardSite.image,
      "og:image:type": "image/png",
      "og:image:width": "1200",
      "og:image:height": "630",
      "og:image:alt": dashboardSite.imageAlt,
      "twitter:card": "summary_large_image",
      "twitter:site": dashboardSite.twitter,
      "twitter:title": title,
      "twitter:description": page.description,
      "twitter:image": dashboardSite.image,
      "twitter:image:alt": dashboardSite.imageAlt,
    },
  };
}

export function robotsForRequest(url: string) {
  return url === "/auth" || url === "/auth/" ? publicRobots : privateRobots;
}

// Private resource names appear only in the signed-in browser tab, not social tags.
export function resourcePageTitle(title: string, name?: string) {
  return name?.trim() ? `${name.trim()} | ${title}` : title;
}
