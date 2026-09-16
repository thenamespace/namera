/**
 * Every destination the marketing page can link to.
 *
 * The page renders a link only when its value is a string here. Anything set
 * to `null` is a destination nobody has confirmed exists yet, and it is
 * omitted from the UI rather than shipped as a guess: a nav item or footer
 * link that 404s is worse than one that is absent.
 *
 * Fill these in and the corresponding links appear. Do not invent values.
 */
export type SiteLink = string | null;

export const SITE_LINKS = {
  /** The docs live in this app, so this one is real. */
  docs: "/docs",

  /**
   * The dashboard. Taken from `apps/server/.env.prod`, where
   * `AUTH_DASHBOARD_PUBLIC_ORIGIN` is this exact origin, so it is the
   * deployment's own value rather than a guess.
   */
  app: "https://dashboard.namera.ai" as SiteLink,

  /**
   * The server serves a reference at /reference in development and
   * `packages/api` declares https://api.namera.ai as the public server, but
   * nobody has confirmed the reference is exposed there. Left unset.
   */
  apiReference: null as SiteLink,

  /*
   * Taken from the live site at namera.ai, which is where these already point.
   * Terms and the changelog were opened and both carry real content.
   */
  changelog: "https://www.namera.ai/changelog" as SiteLink,
  terms: "https://www.namera.ai/terms" as SiteLink,
  privacy: "https://www.namera.ai/privacy-policy" as SiteLink,

  github: "https://github.com/thenamespace/namera" as SiteLink,
  x: "https://x.com/namera_ai" as SiteLink,
  linkedin: "https://linkedin.com/company/namera-ai" as SiteLink,

  /** Nothing on the live site advertises a status page. */
  status: null as SiteLink,

  /** The address the product's own transactional emails already link to. */
  contact: "mailto:hey@namera.ai" as SiteLink,
} as const satisfies Record<string, SiteLink>;

/** Narrows to the links that have a confirmed destination. */
export const linked = <T extends { readonly href: SiteLink }>(
  items: readonly T[],
): readonly (T & { readonly href: string })[] =>
  items.filter((item): item is T & { href: string } => typeof item.href === "string");
