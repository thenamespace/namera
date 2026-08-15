import type { ApiKeyRevokedEmailVariables } from "@namera-ai/protocol/model";

import { EmailContent } from "../components/content.js";
import { EmailDetail, EmailDetails } from "../components/details.js";
import { EmailLayout } from "../components/layout.js";
import { EmailNotice } from "../components/notice.js";
import { formatEmailCount } from "../helpers/format.js";
import { NameraEmail } from "../provider.js";

export type ApiKeyRevokedEmailProps = ApiKeyRevokedEmailVariables;

export const ApiKeyRevokedEmail = ({
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
          <EmailNotice>
            Requests using this API key are now rejected, and all of its session-key grants have
            been revoked.
          </EmailNotice>
        </EmailContent>
      </EmailLayout>
    </NameraEmail>
  );
};

ApiKeyRevokedEmail.PreviewProps = {
  apiKeyName: "Production agent",
  organizationName: "Atlas Labs",
  sessionKeyCount: 3,
} satisfies ApiKeyRevokedEmailProps;

export default ApiKeyRevokedEmail;
