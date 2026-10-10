import { createFileRoute } from "@tanstack/react-router";

import { Accordion, type AccordionItem } from "#/components/marketing/accordion";
import { ClosingCta } from "#/components/marketing/closing-cta";
import { Container, Reveal, Section } from "#/components/marketing/primitives";
import { SiteFooter } from "#/components/marketing/site-footer";
import { SiteHeader } from "#/components/marketing/site-header";
import { Comparison } from "#/components/pricing/comparison";
import { PlanCards } from "#/components/pricing/plan-cards";
import { jsonLd, seo, SITE } from "#/lib/seo";

/*
 * The numbers come from `architecture/billing`; see the note at the top of
 * `components/pricing/plans.ts` for which file owns which figure, and for why
 * the paid tiers are shown as unavailable rather than as something to buy.
 */

const QUESTIONS: readonly AccordionItem[] = [
  {
    q: "What counts as an execution?",
    a: "A confirmed onchain operation submitted through Namera, including session-key installation and removal. Namera reserves capacity while an operation is in flight. Failed operations release that execution reservation; sponsored gas that was actually spent can still count.",
  },
  {
    q: "When does the month reset?",
    a: "On the day your organization was created, every month. Executions, signatures and sponsored gas reset with it. Counts of things that exist rather than things that happen, like members, do not reset; they are a ceiling you sit under.",
  },
  {
    q: "What happens when I reach a limit on the Free plan?",
    a: "Namera refuses new work when the required allowance is exhausted. Free does not charge overages. Existing accounts and keys are not deleted. Resource limits do not reset, but execution, signature and sponsored-gas allowances renew each month.",
  },
  {
    q: "How is sponsored gas measured?",
    a: "Using the provider-reported cost, including its sponsorship fee. Free includes $3 per workspace each month. Gas is a dollar allowance rather than a transaction count because costs vary by network and activity.",
  },
  {
    q: "How many workspaces can I create?",
    a: "You can own up to 3 workspaces, including your Personal workspace. Joining someone else’s workspace does not use one of those slots. Plan allowances apply separately to each workspace.",
  },
  {
    q: "When does my existing workspace move to Free v2?",
    a: "At its next monthly billing anniversary after the rollout. Your current allowances stay unchanged until then. Accounts and keys above a new capacity limit are retained, but you cannot create more while at or above that limit.",
  },
  {
    q: "Can I use managed accounts or buy a paid plan now?",
    a: "Not yet. 1Claw-managed account and session-key creation is coming soon. Pro, Business and Enterprise are future plans; displayed paid pricing and allowances are provisional and cannot be purchased.",
  },
];

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
              <p className="mx-auto mt-5 max-w-2xl text-balance text-center text-muted">
                Start with Free. Allowances apply per workspace, with up to 3 owned workspaces per
                user. Paid plans and 1Claw-managed creation are coming later.
              </p>
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
                How the counting works
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
