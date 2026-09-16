import { createFileRoute } from "@tanstack/react-router";

import { Container, Section } from "#/components/marketing/primitives";
import { SiteFooter } from "#/components/marketing/site-footer";
import { SiteHeader } from "#/components/marketing/site-header";
import { seo } from "#/lib/seo";

/*
 * Nothing is published yet, so this says so and is kept out of the index.
 * Nothing in the site's navigation points here while it reads like this.
 */
export const Route = createFileRoute("/blog")({
  component: BlogComingSoon,
  head: () =>
    seo({
      title: "Blog",
      description: "Writing from the team building Namera. Nothing published yet.",
      path: "/blog",
      noindex: true,
    }),
});

function BlogComingSoon() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main id="main" className="flex flex-1 items-center pt-14">
        <Section className="w-full">
          <Container>
            <p className="type-eyebrow text-ink-subtle">Blog</p>
            <h1 className="type-display-lg mt-5 max-w-[14ch] text-balance text-foreground">
              Nothing here yet
            </h1>
            <p className="type-lead mt-6 max-w-[46ch] text-pretty text-muted">
              We would rather publish nothing than publish filler. The first post lands when there
              is something worth reading.
            </p>
          </Container>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}
