import { createFileRoute } from "@tanstack/react-router";

import { Container, Section } from "#/components/marketing/primitives";
import { SiteFooter } from "#/components/marketing/site-footer";
import { SiteHeader } from "#/components/marketing/site-header";
import { seo } from "#/lib/seo";

/*
 * The docs are not written yet, so this route says so rather than serving a
 * one-page stub behind a "Docs" link. The MDX setup it replaced (Fumadocs, a
 * `content/docs` collection and a search route) is in git history.
 *
 * Nothing in the site's navigation points here while it reads like this.
 */
export const Route = createFileRoute("/docs/$")({
  component: DocsComingSoon,
  head: () =>
    seo({
      title: "Documentation",
      description: "Namera's documentation is being written and will be here when Namera opens.",
      path: "/docs",
      noindex: true,
    }),
});

function DocsComingSoon() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main id="main" className="flex flex-1 items-center pt-14">
        <Section className="w-full">
          <Container>
            <p className="type-eyebrow text-center text-ink-subtle">Documentation</p>
            <h1 className="type-display-lg mx-auto mt-5 max-w-[14ch] text-balance text-center text-foreground">
              Coming soon
            </h1>
            <p className="type-lead mx-auto mt-6 max-w-[46ch] text-pretty text-center text-muted">
              The reference is being written and will be here when Namera opens.
            </p>
          </Container>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}
