import type { SessionKeyCreatedEmailVariables } from "@namera-ai/protocol/model";

import { EmailContent } from "../components/content.js";
import { EmailDetail, EmailDetails } from "../components/details.js";
import { EmailLayout } from "../components/layout.js";
import { EmailNotice } from "../components/notice.js";
import { NameraEmail } from "../provider.js";

export type SessionKeyCreatedEmailProps = SessionKeyCreatedEmailVariables;

export const SessionKeyCreatedEmail = ({
  expiresAt,
  organizationName,
  sessionKeyName,
  walletName,
}: SessionKeyCreatedEmailProps) => {
  return (
    <NameraEmail preview={`${sessionKeyName} was created for ${walletName}.`}>
      <EmailLayout compactOnMobile>
        <EmailContent
          description={`A new scoped session key was created in ${organizationName}.`}
          title="Session key created"
        >
          <EmailDetails>
            <EmailDetail label="Session key" value={sessionKeyName} />
            <EmailDetail label="Account" value={walletName} />
            <EmailDetail label="Expires" value={expiresAt} />
          </EmailDetails>
          <EmailNotice>
            Session keys are limited by their attached policies. Review its grants if you do not
            recognize this change.
          </EmailNotice>
        </EmailContent>
      </EmailLayout>
    </NameraEmail>
  );
};

SessionKeyCreatedEmail.PreviewProps = {
  expiresAt: "Sep 14, 2026, 8:30 AM UTC",
  organizationName: "Atlas Labs",
  sessionKeyName: "Trading agent",
  walletName: "Treasury",
} satisfies SessionKeyCreatedEmailProps;

export default SessionKeyCreatedEmail;
