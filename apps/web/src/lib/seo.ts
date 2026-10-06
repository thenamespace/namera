/*
 * One place that builds a page's head.
 *
 * Every route calls `seo()` rather than hand-writing tags, so a page cannot
 * ship with a title but no description, or an Open Graph card that disagrees
 * with the title above it. Page titles are used as written, without a suffix.
 */

const siteUrl = new URL(import.meta.env.VITE_SITE_URL || "https://namera.ai");
if (!["http:", "https:"].includes(siteUrl.protocol) || siteUrl.username || siteUrl.password) {
  throw new Error("VITE_SITE_URL must be an HTTP(S) URL without credentials");
}

export const SITE = {
  name: "Namera",
  origin: siteUrl.origin,
  tagline: "Wallets for AI agents with permissions built in",
  heroDescription: "Give agents the power to transact. You set what they can spend and do.",
  /** Shared search, social and structured-data description. */
  description:
    "Namera gives AI agents wallets with permissions built in. Set what they can spend and do, with spending limits, scoped permissions, and access expiry.",
  keywords: [
    "agent wallet",
    "AI agent wallets",
    "wallet permissions",
    "AI agent payments",
    "session keys",
    "spend limits",
    "programmable wallets",
    "smart accounts",
    "ERC-4337",
    "account abstraction",
    "MCP wallet",
    "agent custody",
  ],
  /** Shared 1200x630 artwork, published from assets/seo. */
  ogImage: "https://cdn.namera.ai/seo/og.png",
  ogImageAlt: "Namera logo and wordmark on a dark charcoal gradient",
  logo: "https://cdn.namera.ai/seo/icon-512.png",
  twitter: "@namera_ai",
} as const;

type SeoInput = {
  /** Page title. Omit to use the home page title. */
  readonly title?: string;
  readonly description: string;
  /** Path with a leading slash, used for the canonical and og:url. */
  readonly path: string;
  /** Pages that should not be indexed while they say "coming soon". */
  readonly noindex?: boolean;
  readonly type?: "website" | "article";
};

type MetaTag =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string };

type LinkTag = { rel: string; href: string };

export const seo = ({ title, description, path, noindex = false, type = "website" }: SeoInput) => {
  const full = title ?? `${SITE.name} - ${SITE.tagline}`;
  const url = `${SITE.origin}${path}`;
  const image = SITE.ogImage;

  return {
    meta: [
      { title: full },
      { name: "description", content: description },
      { name: "keywords", content: SITE.keywords.join(", ") },

      { property: "og:site_name", content: SITE.name },
      { property: "og:title", content: full },
      { property: "og:description", content: description },
      { property: "og:type", content: type },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:alt", content: SITE.ogImageAlt },
      { property: "og:locale", content: "en_US" },

      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: SITE.twitter },
      { name: "twitter:title", content: full },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      { name: "twitter:image:alt", content: SITE.ogImageAlt },
      { name: "twitter:creator", content: SITE.twitter },

      {
        name: "robots",
        content: noindex ? "noindex, follow" : "index, follow, max-image-preview:large",
      },
    ] as MetaTag[],
    links: [{ rel: "canonical", href: url }] as LinkTag[],
    scripts: [
      jsonLd({
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: full,
        description,
        isPartOf: { "@id": `${SITE.origin}/#website` },
        publisher: { "@id": `${SITE.origin}/#organization` },
        inLanguage: "en-US",
      }),
    ],
  };
};

/** Serialises a JSON-LD node for a route's `scripts`. */
export const jsonLd = (data: Record<string, unknown>) => ({
  type: "application/ld+json",
  children: JSON.stringify(data).replace(/</g, "\\u003c"),
});

export const ORGANIZATION = {
  "@type": "Organization",
  "@id": `${SITE.origin}/#organization`,
  name: SITE.name,
  url: SITE.origin,
  logo: SITE.logo,
  description: SITE.description,
  sameAs: [
    "https://github.com/thenamespace/namera",
    "https://x.com/namera_ai",
    "https://linkedin.com/company/namera-ai",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "hey@namera.ai",
    url: SITE.origin,
  },
} as const;

export const WEBSITE = {
  "@type": "WebSite",
  "@id": `${SITE.origin}/#website`,
  url: SITE.origin,
  name: SITE.name,
  description: SITE.description,
  publisher: { "@id": `${SITE.origin}/#organization` },
  inLanguage: "en-US",
} as const;
