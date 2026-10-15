// Unconfirmed destinations stay null and are omitted from navigation.
export type SiteLink = string | null;

export const SITE_LINKS = {
  docs: "/docs",
  app: "https://dashboard.namera.ai" as SiteLink,

  /**
   * The server serves a reference at /reference in development and
   * `packages/api` declares https://api.namera.ai as the public server, but
   * nobody has confirmed the reference is exposed there. Left unset.
   */
  apiReference: null as SiteLink,

  changelog: "https://www.namera.ai/changelog" as SiteLink,
  terms: "/terms" as SiteLink,
  privacy: "/privacy-policy" as SiteLink,

  github: "https://github.com/thenamespace/namera" as SiteLink,
  x: "https://x.com/namera_ai" as SiteLink,
  linkedin: "https://linkedin.com/company/namera-ai" as SiteLink,

  status: null as SiteLink,
  contact: "mailto:hey@namera.ai" as SiteLink,
} as const satisfies Record<string, SiteLink>;

export const linked = <T extends { readonly href: SiteLink }>(
  items: readonly T[],
): readonly (T & { readonly href: string })[] =>
  items.filter((item): item is T & { href: string } => typeof item.href === "string");
