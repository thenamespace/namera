import type { MagicLinkEmailVariables } from "@namera-ai/protocol/model";
import { Heading, Hr, Link, Section, Text } from "react-email";

import { EmailButton } from "../components/button.js";
import { EmailLayout } from "../components/layout.js";
import { VerificationCode } from "../components/verification-code.js";
import { NameraEmail } from "../provider.js";

export type MagicLinkEmailProps = MagicLinkEmailVariables;

export const MagicLinkEmail = ({ code, expiresInMinutes, magicLinkUrl }: MagicLinkEmailProps) => {
  return (
    <NameraEmail preview={`Sign in to Namera. This link expires in ${expiresInMinutes} minutes.`}>
      <EmailLayout>
        <Heading
          as="h1"
          className="m-0 text-2xl font-semibold leading-8 tracking-[-0.5px] text-email-light-foreground dark:text-email-dark-foreground"
        >
          Sign in to Namera
        </Heading>

        <Text className="mt-3 mb-0 text-sm leading-6 text-email-light-muted dark:text-email-dark-muted">
          Use the secure link below to sign in. It expires in {expiresInMinutes} minutes and can
          only be used once.
        </Text>

        <Section className="my-7">
          <EmailButton href={magicLinkUrl}>Sign in to Namera</EmailButton>
        </Section>

        <Hr className="my-7 border-0 border-t border-solid border-email-light-border dark:border-email-dark-border" />

        <Text className="mt-0 mb-4 text-sm leading-5 text-email-light-muted dark:text-email-dark-muted">
          Or enter this code on the sign-in screen:
        </Text>

        <VerificationCode code={code} />

        <Text className="mt-7 mb-0 text-xs leading-5 text-email-light-muted dark:text-email-dark-muted">
          If the button does not work, copy and paste this link into your browser:
          <br />
          <Link className="break-all text-email-accent underline" href={magicLinkUrl}>
            {magicLinkUrl}
          </Link>
        </Text>

        <Text className="mt-6 mb-0 text-xs leading-5 text-email-light-muted dark:text-email-dark-muted">
          If you did not request this email, you can safely ignore it. Your account remains secure.
        </Text>
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
