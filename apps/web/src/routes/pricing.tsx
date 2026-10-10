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
    q: "What can I do on the Free plan?",
    a: "Each workspace includes 5 members, 10 user-owned accounts, 3 managed accounts, 100 local session keys and 5 managed session keys. You also get 100 mainnet executions, 500 testnet executions, 1,000 signatures and $3 in sponsored gas each month.",
  },
  {
    q: "Are limits shared across my workspaces?",
    a: "No. Each workspace has its own allowances. You can own up to 3 workspaces, including your Personal workspace. Workspaces you join do not count toward that limit.",
  },
  {
    q: "What is the difference between user-owned and managed keys?",
    a: "A user-owned account uses your passkey for owner approvals. A local session key uses a private key you hold. Managed accounts and session keys use a signing provider, so you do not need to store a private key yourself. Each type has its own allowance.",
  },
  {
    q: "What counts as an execution?",
    a: "Successful operations submitted through Namera count toward your execution allowance, including transactions, ENS operations, and session-key installation and removal. Mainnet and testnet executions have separate limits. Failed operations do not use an execution, but any sponsored gas spent can still count.",
  },
  {
    q: "When do my allowances reset?",
    a: "Executions, signatures and sponsored gas renew each month on your workspace’s billing anniversary. You can see the next reset date in Billing. Member, account and session-key limits do not reset each month. A session key used on multiple networks still takes one slot.",
  },
  {
    q: "What happens when I reach a limit on the Free plan?",
    a: "The action that needs the exhausted allowance is blocked. Your existing accounts and keys are not deleted, and Free has no overage charges. For monthly usage, wait until the next reset. For session-key capacity, revoke keys you no longer need.",
  },
  {
    q: "What does the sponsored gas allowance cover?",
    a: "It covers supported mainnet gas sponsorship, including the provider’s sponsorship fee. Free includes $3 per workspace each month. Gas is measured in dollars because costs vary by network and operation; a sponsored transaction also uses an execution.",
  },
  {
    q: "Can I upgrade to a paid plan?",
    a: "Not yet. Pro, Business and Enterprise are coming soon. Their listed prices and allowances are planned and may change before launch. Contact hey@namera.ai if you need higher limits or want to discuss your team’s requirements.",
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
