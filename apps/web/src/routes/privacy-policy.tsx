import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "#/components/legal/legal-page";
import { legalMdxComponents } from "#/components/legal/mdx-components";
import PrivacyPolicy, { toc } from "#/content/legal/privacy-policy.mdx";
import { seo } from "#/lib/seo";

const DESCRIPTION =
  "How Namera handles account information, wallet activity, and service data, and how to contact us about your privacy.";

export const Route = createFileRoute("/privacy-policy")({
  head: () =>
    seo({
      title: "Privacy Policy",
      description: DESCRIPTION,
      path: "/privacy-policy",
      noindex: true,
    }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" description={DESCRIPTION} toc={toc}>
      <PrivacyPolicy components={legalMdxComponents} />
    </LegalPage>
  );
}
