import { Accordion, type AccordionItem } from "#/components/marketing/accordion";
import { Container, Reveal, Section } from "#/components/marketing/primitives";

export const FAQ_QUESTIONS: readonly AccordionItem[] = [
  {
    q: "Can an agent raise its own limits?",
    a: "No. A key is fixed once it is issued. Its end date, its networks, and every limit on it are locked in at that moment and cannot be edited by anything holding the key. Changing any of them means revoking it and issuing a new one, which takes a person with permission and an approval from their passkey.",
  },
  {
    q: "Where do private keys live?",
    a: "Your account is owned by a passkey you hold. Session keys are generated on your side, encrypted with a passphrase you choose, and imported on the machine that will use them. Namera is only ever given their public half, so there is no private key on our side to export or leak.",
  },
  {
    q: "What happens when a policy denies an operation?",
    a: "It stops at the first rule that says no, and your client gets an error saying which one. Nothing is signed, nothing is spent against your budgets, and you are not billed for it. The refusal is written to the audit log like any other event.",
  },
  {
    q: "Which chains are supported?",
    a: "Ethereum, Base, Arbitrum, and Optimism, each with its testnet. All eight run the same smart-account setup, so a key behaves identically across them. Only EVM chains are supported today; the protocol was built so other chain families can be added later without changing the API you integrate against.",
  },
  {
    q: "What will it cost?",
    a: "There is a free plan, and it is the only one you will be able to pick when Namera opens. The paid tiers are still being written; the pricing page carries their allowances as they stand.",
  },
  {
    q: "How do agent clients connect?",
    a: "Each one is given access to a specific key: an API key for a server, the CLI once you log in, or the MCP server for an agent client. Taking that access away cuts off just that client and leaves the key and every other client working.",
  },
  {
    q: "Does this work with Claude, Cursor, and other MCP clients?",
    a: "Yes. The MCP server runs on your own machine and holds the signing key there, so the model sees a set of tools and never a credential. Every call it makes is previewed and checked against your rules exactly as the SDK is.",
  },
];

/*
 * The heading is set at display size and left to sit on its own line, with the
 * questions below it at full width. A narrow column of questions beside a
 * narrow heading wastes the page; this gives the answers room to be read.
 */
export const Faq = () => (
  <Section className="border-t-1 border-border">
    <Container>
      <Reveal>
        <h2 className="type-display-lg max-w-[16ch] text-balance text-foreground">
          Questions worth asking first
        </h2>
      </Reveal>

      <Reveal delay={0.06} className="mt-12 md:mt-16">
        <Accordion items={FAQ_QUESTIONS} idPrefix="faq" />
      </Reveal>
    </Container>
  </Section>
);
