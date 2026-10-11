import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "#/components/legal/legal-page";
import { legalMdxComponents } from "#/components/legal/mdx-components";
import Terms from "#/content/legal/terms.mdx";
import { seo } from "#/lib/seo";

const DESCRIPTION =
  "The terms for using Namera's programmable wallets, dashboard, API, and developer tools.";

export const Route = createFileRoute("/(legal)/terms")({
  head: () =>
    seo({
      title: "Terms of Service | Namera",
      description: DESCRIPTION,
      path: "/terms",
      dateModified: "2026-10-05",
    }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <Terms components={legalMdxComponents} />
    </LegalPage>
  );
}
