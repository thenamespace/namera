import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@namera-ai/ui/components/ui/accordion";

export const faqs = [
  {
    answer:
      "A programmable wallet layer for autonomous agents — scoped session keys, onchain-enforced policies, no key exposure.",
    key: "question-1",
    question: "What is Namera?",
  },
  {
    answer:
      "Through session keys: delegated credentials with explicit rules on what the agent can call, spend, and when.",
    key: "question-2",
    question: "How do agents access wallets?",
  },
  {
    answer:
      "Yes. Permissions are enforced at the contract level — no server-side rule an agent can route around.",
    key: "question-3",
    question: "Are funds safe if agents control wallets?",
  },
  {
    answer:
      "No. Use the managed platform and start immediately. The CLI is there if you prefer local-first keystores.",
    key: "question-4",
    question: "Do I need to run infrastructure?",
  },
  {
    answer: "SDK for apps, CLI for local workflows, MCP server for agents.",
    key: "question-5",
    question: "How do I integrate Namera?",
  },
  {
    answer:
      "A local server that gives any MCP-compatible agent wallet capabilities — without touching private keys.",
    key: "question-6",
    question: "What is the MCP server?",
  },
];

export const Faqs = () => {
  return (
    <section
      className="relative px-4 max-w-7xl mx-auto py-[14dvh] flex flex-col gap-16"
      id="faqs"
    >
      {/* Top divider */}
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
        }}
      />
      {/* Ambient glow */}
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-x-0 top-20 mx-auto max-w-2xl h-64 blur-3xl opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(182,214,255,0.12), transparent 70%)",
        }}
      />

      <div className="relative flex flex-col gap-3">
        <p className="text-center text-xs font-medium uppercase tracking-[0.25em] text-white/40">
          FAQ
        </p>
        <h2 className="text-3xl max-w-2xl mx-auto text-center heading-gradient pb-2 sm:text-4xl md:text-5xl tracking-tight">
          Frequently Asked Questions
        </h2>
      </div>
      <div className="relative mx-auto max-w-3xl w-full">
        <div className="relative rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
          {/* Top highlight */}
          <div
            aria-hidden={true}
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
            }}
          />
          <Accordion className="px-6 py-2">
            {faqs.map((faq) => (
              <AccordionItem
                className="py-1 border-white/5"
                key={faq.key}
                value={faq.key}
              >
                <AccordionTrigger className="text-base sm:text-lg font-medium hover:no-underline text-foreground hover:text-white transition-colors">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm sm:text-base font-normal leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};
