import type { SessionKeyCreatedEmailVariables } from "@namera-ai/protocol/model";

import { EmailAction } from "../components/action.js";
import { EmailContent } from "../components/content.js";
import { EmailDetail, EmailDetails } from "../components/details.js";
import { EmailLayout } from "../components/layout.js";
import { EmailNotice } from "../components/notice.js";
import { formatEmailDate } from "../helpers/date.js";
import { NameraEmail } from "../provider.js";

export type SessionKeyCreatedEmailProps = SessionKeyCreatedEmailVariables;

export const SessionKeyCreatedEmail = ({
  actionUrl,
  expiresAt,
  organizationName,
  sessionKeyName,
  walletName,
}: SessionKeyCreatedEmailProps) => {
  return (
    <NameraEmail preview={`${sessionKeyName} was created for ${walletName}.`}>
      <EmailLayout>
        <EmailContent
          description={`A new scoped session key was created in ${organizationName}.`}
          title="Session key created"
        >
          <EmailDetails>
            <EmailDetail label="Session key" value={sessionKeyName} />
            <EmailDetail label="Account" value={walletName} />
            <EmailDetail label="Expires" value={formatEmailDate(expiresAt)} />
          </EmailDetails>
          <EmailAction href={actionUrl}>View session key</EmailAction>
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
  actionUrl:
    "https://dashboard.namera.ai/auth?returnTo=%2Fsession-key%2Fexample-session-key-id%2Foverview",
  expiresAt: "2026-09-14T08:30:00.000Z",
  organizationName: "Atlas Labs",
  sessionKeyName: "Trading agent",
  walletName: "Treasury",
} satisfies SessionKeyCreatedEmailProps;

export default SessionKeyCreatedEmail;
