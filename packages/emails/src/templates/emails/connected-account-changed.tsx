import type { EmailJobPayload } from "@namera-ai/protocol/model";

import { EmailContent } from "../components/content.js";
import { EmailDetail, EmailDetails } from "../components/details.js";
import { EmailLayout } from "../components/layout.js";
import { EmailNotice } from "../components/notice.js";
import { formatEmailDate } from "../helpers/date.js";
import { NameraEmail } from "../provider.js";

type Props = Extract<EmailJobPayload, { type: "connected-account-changed" }>["variables"];

export const ConnectedAccountChangedEmail = ({ provider, action, changedAt }: Props) => (
  <NameraEmail preview={`${provider} sign-in was ${action}.`}>
    <EmailLayout>
      <EmailContent
        title={`${provider} ${action}`}
        description={
          action === "connected"
            ? `You can now sign in to Namera with ${provider}. Email sign-in remains available.`
            : `${provider} sign-in has been removed. You can still sign in to Namera with your email.`
        }
      >
        <EmailDetails>
          <EmailDetail label="Changed at" value={formatEmailDate(changedAt)} />
        </EmailDetails>
        <EmailNotice>
          If you did not make this change, sign in with your email and review your connected
          accounts and active sessions in Security settings.
        </EmailNotice>
      </EmailContent>
    </EmailLayout>
  </NameraEmail>
);
