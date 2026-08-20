import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@namera-ai/ui/components/ui/accordion";

const faqs = [
  {
    answer:
      "Namera is the policy and permission layer for AI agents that move money onchain. You define what an agent can spend and call; Namera issues scoped, revocable session keys and enforces those rules onchain.",
    key: "question-1",
    question: "What is Namera?",
  },
  {
    answer:
      "No. Namera sits above your wallet infrastructure. Use ZeroDev, Safe, Privy, Turnkey, or Coinbase AgentKit. Namera defines what the agent is allowed to do, without replacing the wallet you already run.",
    key: "question-2",
    question: "Does Namera replace my wallet?",
  },
  {
    answer:
      "Yes. Namera is built to bound agentic payment rails like x402 and MPP, not compete with them. Agents pay over the rail; Namera enforces the spend limits, allowlists, and expiry on top.",
    key: "question-3",
    question: "Does it work with x402 and MPP?",
  },
  {
    answer:
      "Agents never touch your primary key. They use session keys, secondary keys with scoped permissions that you issue, monitor, and revoke.",
    key: "question-4",
    question: "How do agents get access?",
  },
  {
    answer:
      "Its access is already limited by policy, and you can revoke the key instantly without affecting your main wallet or any other agent. Anything outside the policy reverts onchain.",
    key: "question-5",
    question: "What happens if an agent is compromised?",
  },
  {
    answer:
      "Policies are rules attached to a session key: allowed contracts, spend caps, rate limits, and expiry. They're enforced directly onchain, so the agent can't bypass or modify them.",
    key: "question-6",
    question: "What are onchain policies?",
  },
  {
    answer:
      "Use the SDK for full integration, the CLI for local workflows, or connect an agent directly through the MCP server. Namera is local-first, so you don't need to run backend infrastructure to start.",
    key: "question-7",
    question: "How do I integrate Namera?",
  },
  {
    answer:
      "Yes. Namera supports multi-chain execution through a unified interface, so agents can operate across networks without managing separate wallets.",
    key: "question-8",
    question: "Which chains does it support?",
  },
];

export const Faqs = () => {
  return (
    <section
      className="relative px-4 max-w-7xl mx-auto py-[14dvh] flex flex-col gap-16"
      id="faqs"
    >
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
        }}
      />
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
        <div className="relative rounded-2xl border border-white/10 bg-white/2 backdrop-blur-sm overflow-hidden">
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
