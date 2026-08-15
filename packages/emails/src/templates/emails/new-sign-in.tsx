import type { NewSignInEmailVariables } from "@namera-ai/protocol/model";

import { EmailContent } from "../components/content.js";
import { EmailDetail, EmailDetails } from "../components/details.js";
import { EmailLayout } from "../components/layout.js";
import { EmailNotice } from "../components/notice.js";
import { formatEmailDate } from "../helpers/date.js";
import { NameraEmail } from "../provider.js";

export type NewSignInEmailProps = NewSignInEmailVariables;

export const NewSignInEmail = ({ ipAddress, signedInAt, userAgent }: NewSignInEmailProps) => {
  return (
    <NameraEmail preview="A new sign-in to your Namera account was detected.">
      <EmailLayout>
        <EmailContent
          description="A new session was created for your Namera account. Review the details below."
          title="New sign-in detected"
        >
          <EmailDetails>
            <EmailDetail label="Signed in at" value={formatEmailDate(signedInAt)} />
            <EmailDetail label="IP address" mono value={ipAddress} />
            <EmailDetail label="Device" value={userAgent} />
          </EmailDetails>
          <EmailNotice>
            If this was you, no action is needed. If you do not recognize this sign-in, review your
            active sessions and sign out the session immediately.
          </EmailNotice>
        </EmailContent>
      </EmailLayout>
    </NameraEmail>
  );
};

NewSignInEmail.PreviewProps = {
  ipAddress: "203.0.113.42",
  signedInAt: "2026-08-15T08:30:00.000Z",
  userAgent: "Chrome 150 on macOS",
} satisfies NewSignInEmailProps;

export default NewSignInEmail;
