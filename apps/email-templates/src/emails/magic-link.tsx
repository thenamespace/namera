import type { MagicLinkEmailVariables } from "@namera-ai/protocol/model";
import { Hr, Section, Text } from "react-email";

import { EmailButton } from "../components/button.js";
import { EmailContent } from "../components/content.js";
import { FallbackLink } from "../components/fallback-link.js";
import { EmailLayout } from "../components/layout.js";
import { VerificationCode } from "../components/verification-code.js";
import { NameraEmail } from "../provider.js";

export type MagicLinkEmailProps = MagicLinkEmailVariables;

export const MagicLinkEmail = ({ code, expiresInMinutes, magicLinkUrl }: MagicLinkEmailProps) => {
  return (
    <NameraEmail preview={`Sign in to Namera. This link expires in ${expiresInMinutes} minutes.`}>
      <EmailLayout>
        <EmailContent
          description={
            <>
              Use the secure link below to sign in. It expires in {expiresInMinutes} minutes and can
              only be used once.
            </>
          }
          title="Sign in to Namera"
        >
          <Section className="mb-7">
            <EmailButton href={magicLinkUrl}>Sign in to Namera</EmailButton>
          </Section>

          <Hr className="my-7 border-0 border-t border-solid border-email-light-border dark:border-email-dark-border" />

          <Text className="mt-0 mb-4 text-sm leading-5 text-email-light-muted dark:text-email-dark-muted">
            Or enter this code on the sign-in screen:
          </Text>

          <VerificationCode code={code} />

          <FallbackLink href={magicLinkUrl} />

          <Text className="mt-6 mb-0 text-xs leading-5 text-email-light-muted dark:text-email-dark-muted">
            If you did not request this email, you can safely ignore it. Your account remains
            secure.
          </Text>
        </EmailContent>
      </EmailLayout>
    </NameraEmail>
  );
};

MagicLinkEmail.PreviewProps = {
  code: "48291736",
  expiresInMinutes: 10,
  magicLinkUrl: "https://example.com/?token=example-magic-link-token&code=48291736",
} satisfies MagicLinkEmailProps;

export default MagicLinkEmail;
