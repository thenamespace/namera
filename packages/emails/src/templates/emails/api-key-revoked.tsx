import type { ApiKeyRevokedEmailVariables } from "@namera-ai/protocol/model";

import { EmailAction } from "../components/action.js";
import { EmailContent } from "../components/content.js";
import { EmailDetail, EmailDetails } from "../components/details.js";
import { EmailLayout } from "../components/layout.js";
import { EmailNotice } from "../components/notice.js";
import { formatEmailCount } from "../helpers/format.js";
import { NameraEmail } from "../provider.js";

export type ApiKeyRevokedEmailProps = ApiKeyRevokedEmailVariables;

export const ApiKeyRevokedEmail = ({
  actionUrl,
  apiKeyName,
  organizationName,
  sessionKeyCount,
}: ApiKeyRevokedEmailProps) => {
  const revokedAccess = formatEmailCount(sessionKeyCount, "session key", "session keys");

  return (
    <NameraEmail preview={`${apiKeyName} was revoked in ${organizationName}.`}>
      <EmailLayout>
        <EmailContent
          description={`An API key was revoked in ${organizationName}.`}
          title="API key revoked"
        >
          <EmailDetails>
            <EmailDetail label="API key" value={apiKeyName} />
            <EmailDetail label="Revoked access" value={revokedAccess} />
          </EmailDetails>
          <EmailAction href={actionUrl}>View API keys</EmailAction>
          <EmailNotice>
            This key can no longer access your session keys. If you do not recognize this activity,
            review your API keys and check with your workspace team.
          </EmailNotice>
        </EmailContent>
      </EmailLayout>
    </NameraEmail>
  );
};

ApiKeyRevokedEmail.PreviewProps = {
  actionUrl: "https://dashboard.namera.ai/auth?returnTo=%2Fsettings%2Fworkspace%2Fapi-keys",
  apiKeyName: "Production agent",
  organizationName: "Atlas Labs",
  sessionKeyCount: 3,
} satisfies ApiKeyRevokedEmailProps;

export default ApiKeyRevokedEmail;
