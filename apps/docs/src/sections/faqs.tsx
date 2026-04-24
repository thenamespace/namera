import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@namera-ai/ui/components/ui/accordion";

export const faqs = [
  {
    answer:
      "Namera is a programmable wallet infrastructure that lets agents execute onchain transactions within rules you define. Instead of giving full wallet access, you define permissions upfront and let agents operate within those boundaries.",
    key: "question-1",
    question: "What is Namera?",
  },
  {
    answer:
      "Agents don't access your wallet directly. They use session keys — secondary keys with limited permissions — that you issue and control.",
    key: "question-2",
    question: "How do agents access wallets?",
  },
  {
    answer:
      "Yes. Agents can only act within the limits you define — like which contracts they can call, how much they can spend, and how often. They never have unrestricted access to your funds.",
    key: "question-3",
    question: "Are funds safe if agents can execute transactions?",
  },
  {
    answer:
      "Policies are rules attached to a session key that define what an agent is allowed to do. They're enforced directly onchain, so they can't be bypassed or modified by the agent.",
    key: "question-4",
    question: "What are onchain policies?",
  },
  {
    answer:
      "Its access is already restricted by policies. You can revoke the session key instantly without affecting your main wallet or other agents.",
    key: "question-5",
    question: "What happens if an agent is compromised?",
  },
  {
    answer:
      "No. Namera is local-first and can run directly in your environment via CLI or MCP server. You don't need to manage backend infrastructure to get started.",
    key: "question-6",
    question: "Do I need to run infrastructure?",
  },
  {
    answer:
      "You can use the SDK for full integration, the CLI for local workflows, or connect directly to agents through the MCP server. It's designed to plug into existing developer tools and agent environments.",
    key: "question-7",
    question: "How do I integrate Namera?",
  },
  {
    answer:
      "The MCP server lets AI agents connect to Namera and execute actions safely. It acts as the bridge between your agent and the wallet, enforcing permissions during execution.",
    key: "question-8",
    question: "What is the MCP server?",
  },
  {
    answer:
      "Yes. You can create multiple session keys, each with its own policies, and assign them to different agents or roles.",
    key: "question-9",
    question: "Can I use multiple agents with different permissions?",
  },
  {
    answer:
      "Namera supports multi-chain execution through a unified interface, so you can operate across networks without managing separate wallets.",
    key: "question-10",
    question: "Which chains does Namera support?",
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
