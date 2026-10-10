// oxlint-disable react-perf/jsx-no-jsx-as-prop
import { evmPolicyDisplayNames } from "@namera-ai/protocol";
import type { SessionKeyCreatedEmailVariables } from "@namera-ai/protocol/model";

import { EmailAction } from "../components/action.js";
import { EmailContent } from "../components/content.js";
import { EmailCustody } from "../components/custody.js";
import { EmailDetail, EmailDetails } from "../components/details.js";
import { EmailIdentity } from "../components/identity.js";
import { EmailLayout } from "../components/layout.js";
import { EmailNotice } from "../components/notice.js";
import { formatEmailDate } from "../helpers/date.js";
import { NameraEmail } from "../provider.js";

export type SessionKeyCreatedEmailProps = SessionKeyCreatedEmailVariables;

export const SessionKeyCreatedEmail = ({
  actionUrl,
  custody,
  provider,
  policyTypes,
  expiresAt,
  organizationName,
  sessionKeyName,
  sessionKeyLogo,
  walletName,
  walletLogo,
}: SessionKeyCreatedEmailProps) => {
  return (
    <NameraEmail preview={`${sessionKeyName} was created for ${walletName}.`}>
      <EmailLayout>
        <EmailContent
          description={`A new scoped session key was created in ${organizationName}.`}
          title="Session key created"
        >
          <EmailDetails>
            <EmailDetail
              label="Session key"
              value={<EmailIdentity name={sessionKeyName} logo={sessionKeyLogo} />}
            />
            <EmailDetail
              label="Account"
              value={<EmailIdentity name={walletName} logo={walletLogo} />}
            />
            {custody ? (
              <EmailDetail
                label="Custody"
                value={<EmailCustody custody={custody} provider={provider} />}
              />
            ) : null}
            {policyTypes?.length ? (
              <EmailDetail
                label="Policies"
                value={policyTypes.map((type) => evmPolicyDisplayNames[type]).join(", ")}
              />
            ) : null}
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
  custody: "namera-managed",
  provider: "1claw",
  policyTypes: ["evm.signature", "evm.time-window"],
  actionUrl:
    "https://dashboard.namera.ai/auth?returnTo=%2Fsession-key%2Fexample-session-key-id%2Foverview",
  expiresAt: "2026-09-14T08:30:00.000Z",
  organizationName: "Atlas Labs",
  sessionKeyName: "Trading agent",
  sessionKeyLogo: { type: "emoji", value: "🔑" },
  walletLogo: { type: "emoji", value: "💳" },
  walletName: "Treasury",
} satisfies SessionKeyCreatedEmailProps;

export default SessionKeyCreatedEmail;
