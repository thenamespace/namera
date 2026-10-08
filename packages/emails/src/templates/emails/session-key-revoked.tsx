import type { SessionKeyRevokedEmailVariables } from "@namera-ai/protocol/model";

import { EmailAction } from "../components/action.js";
import { EmailContent } from "../components/content.js";
import { EmailDetail, EmailDetails } from "../components/details.js";
import { EmailLayout } from "../components/layout.js";
import { EmailNotice } from "../components/notice.js";
import { formatEmailCount } from "../helpers/format.js";
import { NameraEmail } from "../provider.js";

export type SessionKeyRevokedEmailProps = SessionKeyRevokedEmailVariables;

export const SessionKeyRevokedEmail = ({
  actionUrl,
  organizationName,
  revokedGrantCount,
  sessionKeyName,
  walletName,
}: SessionKeyRevokedEmailProps) => {
  const revokedGrants = formatEmailCount(revokedGrantCount, "grant", "grants");

  return (
    <NameraEmail preview={`${sessionKeyName} was revoked in ${organizationName}.`}>
      <EmailLayout>
        <EmailContent
          description={`A session key was revoked in ${organizationName}.`}
          title="Session key revoked"
        >
          <EmailDetails>
            <EmailDetail label="Session key" value={sessionKeyName} />
            <EmailDetail label="Account" value={walletName} />
            <EmailDetail label="Revoked access" value={revokedGrants} />
          </EmailDetails>
          <EmailAction href={actionUrl}>View session key</EmailAction>
          <EmailNotice>
            New transactions and signatures can no longer use this session key. Every active grant
            referencing it has also been revoked.
          </EmailNotice>
        </EmailContent>
      </EmailLayout>
    </NameraEmail>
  );
};

SessionKeyRevokedEmail.PreviewProps = {
  actionUrl:
    "https://dashboard.namera.ai/auth?returnTo=%2Fsession-key%2Fexample-session-key-id%2Foverview",
  organizationName: "Atlas Labs",
  revokedGrantCount: 3,
  sessionKeyName: "Trading agent",
  walletName: "Treasury",
} satisfies SessionKeyRevokedEmailProps;

export default SessionKeyRevokedEmail;
