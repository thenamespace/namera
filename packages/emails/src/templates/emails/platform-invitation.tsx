import type { EmailJobPayload } from "@namera-ai/protocol/model";

import { EmailButton } from "../components/button.js";
import { EmailContent } from "../components/content.js";
import { EmailDetail, EmailDetails } from "../components/details.js";
import { FallbackLink } from "../components/fallback-link.js";
import { EmailLayout } from "../components/layout.js";
import { EmailNotice } from "../components/notice.js";
import { formatEmailDate } from "../helpers/date.js";
import { NameraEmail } from "../provider.js";

export const PlatformInvitationEmail = ({
  invitationUrl,
  role,
  expiresAt,
}: Extract<EmailJobPayload, { type: "platform-invitation" }>["variables"]) => (
  <NameraEmail preview="You've been invited to the Namera admin team.">
    <EmailLayout>
      <EmailContent
        title="Join the Namera admin team"
        description="Sign in with this email address using Google or email, then accept your invitation."
      >
        <EmailDetails>
          <EmailDetail label="Role" value={role === "operator" ? "Operator" : "Viewer"} />
          <EmailDetail label="Expires" value={formatEmailDate(expiresAt)} />
        </EmailDetails>
        <EmailButton href={invitationUrl}>Review invitation</EmailButton>
        <FallbackLink href={invitationUrl} />
        <EmailNotice>
          Accept only if you expected access to Namera's internal admin tools. Do not forward this
          link.
        </EmailNotice>
      </EmailContent>
    </EmailLayout>
  </NameraEmail>
);
