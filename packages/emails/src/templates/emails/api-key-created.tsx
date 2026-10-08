import type { ApiKeyCreatedEmailVariables } from "@namera-ai/protocol/model";

import { EmailAction } from "../components/action.js";
import { EmailContent } from "../components/content.js";
import { EmailDetail, EmailDetails } from "../components/details.js";
import { EmailLayout } from "../components/layout.js";
import { EmailNotice } from "../components/notice.js";
import { formatEmailCount } from "../helpers/format.js";
import { NameraEmail } from "../provider.js";

export type ApiKeyCreatedEmailProps = ApiKeyCreatedEmailVariables;

export const ApiKeyCreatedEmail = ({
  actionUrl,
  apiKeyName,
  organizationName,
  sessionKeyCount,
}: ApiKeyCreatedEmailProps) => {
  const authorizedAccess = formatEmailCount(sessionKeyCount, "session key", "session keys");

  return (
    <NameraEmail preview={`${apiKeyName} was created in ${organizationName}.`}>
      <EmailLayout>
        <EmailContent
          description={`A new API key was created in ${organizationName}.`}
          title="API key created"
        >
          <EmailDetails>
            <EmailDetail label="API key" value={apiKeyName} />
            <EmailDetail label="Authorized access" value={authorizedAccess} />
          </EmailDetails>
          <EmailAction href={actionUrl}>View API keys</EmailAction>
          <EmailNotice>
            If you do not recognize this activity, review your API keys and revoke any access you
            did not authorize.
          </EmailNotice>
        </EmailContent>
      </EmailLayout>
    </NameraEmail>
  );
};

ApiKeyCreatedEmail.PreviewProps = {
  actionUrl: "https://dashboard.namera.ai/auth?returnTo=%2Fsettings%2Fworkspace%2Fapi-keys",
  apiKeyName: "Production agent",
  organizationName: "Atlas Labs",
  sessionKeyCount: 3,
} satisfies ApiKeyCreatedEmailProps;

export default ApiKeyCreatedEmail;
