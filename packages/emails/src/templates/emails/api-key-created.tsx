import type { ApiKeyCreatedEmailVariables } from "@namera-ai/protocol/model";

import { EmailContent } from "../components/content.js";
import { EmailDetail, EmailDetails } from "../components/details.js";
import { EmailLayout } from "../components/layout.js";
import { EmailNotice } from "../components/notice.js";
import { formatEmailCount } from "../helpers/format.js";
import { NameraEmail } from "../provider.js";

export type ApiKeyCreatedEmailProps = ApiKeyCreatedEmailVariables;

export const ApiKeyCreatedEmail = ({
  apiKeyName,
  organizationName,
  sessionKeyCount,
}: ApiKeyCreatedEmailProps) => {
  const authorizedAccess = formatEmailCount(sessionKeyCount, "session key", "session keys");

  return (
    <NameraEmail preview={`${apiKeyName} was created in ${organizationName}.`}>
      <EmailLayout compactOnMobile>
        <EmailContent
          description={`A new API key was created in ${organizationName}.`}
          title="API key created"
        >
          <EmailDetails>
            <EmailDetail label="API key" value={apiKeyName} />
            <EmailDetail label="Authorized access" value={authorizedAccess} />
          </EmailDetails>
          <EmailNotice>
            The API key secret is never sent by email. Revoke this key immediately if you do not
            recognize it.
          </EmailNotice>
        </EmailContent>
      </EmailLayout>
    </NameraEmail>
  );
};

ApiKeyCreatedEmail.PreviewProps = {
  apiKeyName: "Production agent",
  organizationName: "Atlas Labs",
  sessionKeyCount: 3,
} satisfies ApiKeyCreatedEmailProps;

export default ApiKeyCreatedEmail;
