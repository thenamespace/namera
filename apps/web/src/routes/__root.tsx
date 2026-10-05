import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";

import { jsonLd, ORGANIZATION, SITE, WEBSITE } from "#/lib/seo";

import styles from "#/styles.css?url";

/*
 * Site-wide head. Anything a page overrides (title, description, canonical,
 * the Open Graph card) is set per route through `seo()`; what lives here is
 * what never changes: icons, the manifest, the theme colour, and the two
 * structured-data nodes every page on the site shares.
 */
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${SITE.name} - ${SITE.tagline}` },
      { name: "theme-color", content: "#08090A" },
      { name: "color-scheme", content: "dark" },
      { name: "application-name", content: SITE.name },
      { name: "apple-mobile-web-app-title", content: SITE.name },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "format-detection", content: "telephone=no" },
    ],
    links: [
      { rel: "stylesheet", href: styles },
      /*
       * SVG first, because it is the mark itself at any size. The .ico is for
       * browsers that still ask for one, and the touch icon is a PNG because
       * iOS will not take an SVG.
       */
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "mask-icon", href: "/safari-pinned-tab.svg", color: "#5e6ad2" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "sitemap", type: "application/xml", href: "/sitemap.xml" },
    ],
    scripts: [
      jsonLd({
        "@context": "https://schema.org",
        "@graph": [ORGANIZATION, WEBSITE],
      }),
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen overflow-x-clip bg-background font-sans text-foreground">
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
