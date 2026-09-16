/*
 * One place that builds a page's head.
 *
 * Every route calls `seo()` rather than hand-writing tags, so a page cannot
 * ship with a title but no description, or an Open Graph card that disagrees
 * with the title above it. Titles read "Page | Namera"; the home page is the
 * one exception, where the name leads.
 */

const siteUrl = new URL(import.meta.env.VITE_SITE_URL || "https://namera.ai");
if (!["http:", "https:"].includes(siteUrl.protocol) || siteUrl.username || siteUrl.password) {
  throw new Error("VITE_SITE_URL must be an HTTP(S) URL without credentials");
}

export const SITE = {
  name: "Namera",
  origin: siteUrl.origin,
  tagline: "Programmable wallets for autonomous agents",
  /*
   * Longer than a meta description: this is what the Organization and WebSite
   * schema carry, and what the install manifest shows.
   */
  description:
    "Namera gives an autonomous agent a wallet it cannot misuse. Issue a session key with a spend cap, a list of chains and an expiry, and every transaction the agent asks for is priced, simulated and checked against those rules before anything is signed. Signing keys stay on your machine.",
  keywords: [
    "agent wallet",
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
  /** 1200x630, served from `public/`. */
  ogImage: "/og.png",
  twitter: "@namera_ai",
} as const;

type SeoInput = {
  /** Left of the separator. Omit on the home page. */
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

export const seo = ({
  title,
  description,
  path,
  noindex = false,
  type = "website",
}: SeoInput): { meta: MetaTag[]; links: LinkTag[] } => {
  const full = title === undefined ? `${SITE.name} - ${SITE.tagline}` : `${title} | ${SITE.name}`;
  const url = `${SITE.origin}${path}`;
  const image = `${SITE.origin}${SITE.ogImage}`;

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
      { property: "og:image:alt", content: `${SITE.name} - ${SITE.tagline}` },
      { property: "og:locale", content: "en_US" },

      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: SITE.twitter },
      { name: "twitter:title", content: full },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      { name: "twitter:image:alt", content: `${SITE.name} - ${SITE.tagline}` },
      { name: "twitter:creator", content: SITE.twitter },

      {
        name: "robots",
        content: noindex ? "noindex, follow" : "index, follow, max-image-preview:large",
      },
    ],
    links: [{ rel: "canonical", href: url }],
  };
};

/** Serialises a JSON-LD node for a route's `scripts`. */
export const jsonLd = (data: Record<string, unknown>) => ({
  type: "application/ld+json",
  children: JSON.stringify(data),
});

export const ORGANIZATION = {
  "@type": "Organization",
  "@id": `${SITE.origin}/#organization`,
  name: SITE.name,
  url: SITE.origin,
  logo: `${SITE.origin}/icon-512.png`,
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
