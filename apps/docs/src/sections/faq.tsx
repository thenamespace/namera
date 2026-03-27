import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@namera-ai/ui/components/ui/accordion";

const faqs = [
  {
    answer:
      "Namera is a programmable wallet layer that enables agents to securely interact with smart wallets using scoped access and defined execution rules",
    key: "question-1",
    question: "What is Namera?",
  },
  {
    answer:
      "Agents are granted access through scoped session keys, which define what actions they can perform and under what conditions",
    key: "question-2",
    question: "How do agents access wallets?",
  },
  {
    answer:
      "Yes. All actions are restricted by defined permissions and enforced onchain, preventing unauthorized transactions or access beyond allowed rules",
    key: "question-3",
    question: "Are funds safe if agents control wallets?",
  },
  {
    answer:
      "Session keys provide temporary, scoped access to wallets, allowing agents to perform specific actions without exposing the main private key",
    key: "question-4",
    question: "What are session keys?",
  },
  {
    answer:
      "No. Namera provides a managed platform with hosted services, so you can get started without running your own backend. However, you can also use the CLI to manage your own keystores and smart accounts",
    key: "question-5",
    question: "Do I need to run infrastructure?",
  },
  {
    answer:
      "You can integrate using the SDK for applications, the CLI for local workflows, or the MCP server for agent-based systems",
    key: "question-6",
    question: "How do I integrate Namera?",
  },
  {
    answer:
      "MCP is a programmable interface that allows agents to securely interact with wallets and execute actions within defined rules",
    key: "question-7",
    question: "What is MCP in Namera?",
  },
];

export const Faqs = () => {
  return (
    <section
      className="px-4 max-w-7xl mx-auto my-24 flex flex-col gap-12"
      id="faqs"
    >
      <div className="flex flex-col gap-2">
        <h2 className="font-helveticaDisplay text-3xl sm:text-4xl heading-gradient text-center pb-2">
          Frequently Asked Questions
        </h2>
        <p className="text-center max-w-sm mx-auto text-neutral-200">
          Answers to common questions about Namera and how it works
        </p>
      </div>
      <div className="mx-auto max-w-4xl w-full">
        <Accordion className="border rounded-2xl p-6" defaultValue={[]}>
          {faqs.map((faq) => (
            <AccordionItem className="py-1" key={faq.key} value={faq.key}>
              <AccordionTrigger className="text-base sm:text-lg font-normal">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-neutral-200 text-sm sm:text-base font-light">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
