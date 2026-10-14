import { createFileRoute } from "@tanstack/react-router";

import { Accordion } from "#/components/marketing/accordion";
import { ClosingCta } from "#/components/marketing/closing-cta";
import { Container, Reveal, Section } from "#/components/marketing/primitives";
import { SiteFooter } from "#/components/marketing/site-footer";
import { SiteHeader } from "#/components/marketing/site-header";
import { Comparison } from "#/components/pricing/comparison";
import { PlanCards } from "#/components/pricing/plan-cards";
import { PRICING_QUESTIONS as QUESTIONS } from "#/components/pricing/questions";
import { jsonLd, seo, SITE } from "#/lib/seo";

/*
 * The allowances are documented in `architecture/services/billing.md`; see
 * `components/pricing/plans.ts` for which file owns which figure, and for why
 * the paid tiers are shown as unavailable rather than as something to buy.
 */

const DESCRIPTION =
  "Compare Namera plans for AI agent wallets with permissions built in. Explore spending limits, session keys, and what happens when an agent reaches a limit.";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => {
    const { meta, links, scripts } = seo({
      title: "Namera Pricing | Agent Wallet Plans",
      description: DESCRIPTION,
      path: "/pricing",
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
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: SITE.origin },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "Pricing",
                  item: `${SITE.origin}/pricing`,
                },
              ],
            },
            {
              "@type": "Product",
              "@id": `${SITE.origin}/pricing#product`,
              name: SITE.name,
              description: DESCRIPTION,
              brand: { "@id": `${SITE.origin}/#organization` },
            },
            {
              "@type": "FAQPage",
              "@id": `${SITE.origin}/pricing#faq`,
              mainEntity: QUESTIONS.map((item) => ({
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

function PricingPage() {
  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />

      <main id="main" className="pt-14">
        <Section>
          <Container>
            <Reveal>
              <h1 className="type-display-lg text-center text-foreground">Pricing</h1>
            </Reveal>

            <div className="mt-20 md:mt-28">
              <PlanCards />
            </div>
          </Container>
        </Section>

        <Section className="border-t-1 border-border">
          <Container>
            <Comparison />
          </Container>
        </Section>

        <Section className="border-t-1 border-border">
          <Container>
            <Reveal>
              <h2 className="type-display-lg mx-auto max-w-[20ch] text-balance text-center text-foreground">
                Pricing questions
              </h2>
            </Reveal>
            <Reveal delay={0.06} className="mx-auto mt-12 max-w-[46rem] md:mt-16">
              <Accordion items={QUESTIONS} idPrefix="pricing-faq" />
            </Reveal>
          </Container>
        </Section>

        <ClosingCta />
      </main>

      <SiteFooter />
    </div>
  );
}
