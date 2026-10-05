import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "#/components/legal/legal-page";
import { legalMdxComponents } from "#/components/legal/mdx-components";
import Terms, { toc } from "#/content/legal/terms.mdx";
import { seo } from "#/lib/seo";

const DESCRIPTION =
  "The terms for using Namera's programmable wallets, dashboard, API, and developer tools.";

export const Route = createFileRoute("/terms")({
  head: () =>
    seo({ title: "Terms of Service", description: DESCRIPTION, path: "/terms", noindex: true }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Terms of Service" description={DESCRIPTION} toc={toc}>
      <Terms components={legalMdxComponents} />
    </LegalPage>
  );
}
