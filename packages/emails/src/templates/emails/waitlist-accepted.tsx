import type { WaitlistAcceptedEmailVariables } from "@namera-ai/protocol/model";
import { Text } from "react-email";

import { EmailAction } from "../components/action.js";
import { EmailContent } from "../components/content.js";
import { EmailDetail, EmailDetails } from "../components/details.js";
import { EmailLayout } from "../components/layout.js";
import { EmailNotice } from "../components/notice.js";
import { formatEmailDate } from "../helpers/date.js";
import { NameraEmail } from "../provider.js";

export type WaitlistAcceptedEmailProps = WaitlistAcceptedEmailVariables;

export const WaitlistAcceptedEmail = ({
  inviteCode,
  invitationUrl,
  expiresAt,
}: WaitlistAcceptedEmailProps) => (
  <NameraEmail preview="Your Namera invite is ready. Join with the invite code inside.">
    <EmailLayout>
      <EmailContent
        title="Your invite is ready"
        description="You've been accepted from the Namera waitlist. You can now create your account and start building with agent wallets."
      >
        <EmailDetails>
          <EmailDetail label="Invite code" mono value={inviteCode} />
          <EmailDetail label="Use your invite before" value={formatEmailDate(expiresAt)} />
        </EmailDetails>
        <EmailAction href={invitationUrl}>Join Namera</EmailAction>
        <Text className="mt-5 mb-0 text-sm leading-6 text-email-light-muted dark:text-email-dark-muted">
          Sign in with the email address that received this invitation. Your invite is included in
          the link. If you're asked for a code, enter the one above.
        </Text>
        <EmailNotice>
          This invite can be used once. Keep it for yourself and do not forward this email.
        </EmailNotice>
      </EmailContent>
    </EmailLayout>
  </NameraEmail>
);

WaitlistAcceptedEmail.PreviewProps = {
  inviteCode: "ABC234",
  invitationUrl: "https://dashboard.namera.ai/auth?invite=ABC234",
  expiresAt: "2026-10-15T12:00:00.000Z",
} satisfies WaitlistAcceptedEmailProps;

export default WaitlistAcceptedEmail;
