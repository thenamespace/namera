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
    a: "Free includes 10 self-owned accounts, 100 self-owned session keys, 100 mainnet executions, 500 testnet executions, 1,000 signatures and $3 in sponsored gas per workspace. You can own up to 3 workspaces with 5 members each. 1Claw-managed creation and paid plans are coming later; see Pricing for the details.",
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
 * A centred heading over a single, width-capped column of questions. Capping the
 * list keeps every row and every answer a comfortable reading measure rather
 * than stretching them across the full page.
 */
export const Faq = () => (
  <Section className="border-t-1 border-border">
    <Container>
      <Reveal>
        <h2 className="type-display-lg mx-auto max-w-[20ch] text-balance text-center text-foreground">
          Questions, answered.
        </h2>
      </Reveal>

      <Reveal delay={0.06} className="mx-auto mt-12 max-w-[46rem] md:mt-16">
        <Accordion items={FAQ_QUESTIONS} idPrefix="faq" />
      </Reveal>
    </Container>
  </Section>
);
