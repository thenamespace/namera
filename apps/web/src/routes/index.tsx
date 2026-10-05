import { createFileRoute } from "@tanstack/react-router";

import { MotionConfig } from "motion/react";

import { Clients } from "#/components/marketing/clients";
import { ClosingCta } from "#/components/marketing/closing-cta";
import { ExecutionPath } from "#/components/marketing/execution-path";
import { Faq, FAQ_QUESTIONS } from "#/components/marketing/faq";
import { Hero } from "#/components/marketing/hero";
import { Industries } from "#/components/marketing/industries";
import { KeyAnatomy } from "#/components/marketing/key-anatomy";
import { Pillars } from "#/components/marketing/pillars";
import { Playground } from "#/components/marketing/playground";
import { SiteFooter } from "#/components/marketing/site-footer";
import { SiteHeader } from "#/components/marketing/site-header";
import { jsonLd, seo, SITE } from "#/lib/seo";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => {
    const { meta, links, scripts } = seo({
      description: SITE.description,
      path: "/",
    });
    return {
      meta,
      links,
      scripts: [
        ...scripts,
        jsonLd({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SoftwareApplication",
              "@id": `${SITE.origin}/#app`,
              name: SITE.name,
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Web, macOS, Linux, Windows",
              url: SITE.origin,
              description: SITE.description,
              publisher: { "@id": `${SITE.origin}/#organization` },
              mainEntityOfPage: { "@id": `${SITE.origin}/#webpage` },
              featureList: ["Spending limits", "Scoped permissions", "Time-bound access"],
            },
            {
              "@type": "FAQPage",
              "@id": `${SITE.origin}/#faq`,
              mainEntity: FAQ_QUESTIONS.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            },
          ],
        }),
      ],
    };
  },
});

/*
 * Section order follows the argument, not a template:
 * the promise, why it holds, the limit itself, the rest of the controls, how
 * access works, how you wire it, where it is used, what happens when something
 * is wrong, what it runs on, the open questions, the ask.
 */
function HomePage() {
  return (
    // `reducedMotion="user"` drops every transform animation on the page when
    // the OS asks for it, leaving opacity transitions intact.
    <MotionConfig reducedMotion="user">
      <div className="landing-home landing-page-layout relative min-h-screen bg-background">
        <a
          href="#main"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-60 focus-visible:rounded-lg focus-visible:border-1 focus-visible:border-border focus-visible:bg-surface focus-visible:px-3.5 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-foreground"
        >
          Skip to content
        </a>

        <SiteHeader />

        <main id="main">
          <Hero />
          <Pillars />
          <Playground />
          <KeyAnatomy />
          {/* Hidden for now — "Four things the policy stops" */}
          {/* <PolicyGrid /> */}
          <ExecutionPath />
          <Clients />
          <Industries />
          <Faq />
          <ClosingCta />
        </main>

        <SiteFooter />
      </div>
    </MotionConfig>
  );
}
