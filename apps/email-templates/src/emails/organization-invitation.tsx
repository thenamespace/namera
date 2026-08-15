import type { OrganizationInvitationEmailVariables } from "@namera-ai/protocol/model";
import { Section } from "react-email";

import { EmailButton } from "../components/button.js";
import { EmailContent } from "../components/content.js";
import { EmailDetail, EmailDetails } from "../components/details.js";
import { FallbackLink } from "../components/fallback-link.js";
import { EmailLayout } from "../components/layout.js";
import { EmailNotice } from "../components/notice.js";
import { formatEmailDate } from "../helpers/date.js";
import { NameraEmail } from "../provider.js";

export type OrganizationInvitationEmailProps = OrganizationInvitationEmailVariables;

export const OrganizationInvitationEmail = ({
  expiresAt,
  invitationUrl,
  inviterName,
  organizationName,
  roleName,
}: OrganizationInvitationEmailProps) => {
  return (
    <NameraEmail preview={`${inviterName} invited you to join ${organizationName} on Namera.`}>
      <EmailLayout>
        <EmailContent
          description={`${inviterName} invited you to collaborate in ${organizationName}.`}
          title={`Join ${organizationName}`}
        >
          <EmailDetails>
            <EmailDetail label="Organization" value={organizationName} />
            <EmailDetail label="Invited by" value={inviterName} />
            <EmailDetail label="Role" value={roleName} />
            <EmailDetail label="Invitation expires" value={`${formatEmailDate(expiresAt)} UTC`} />
          </EmailDetails>
          <Section className="mt-7">
            <EmailButton href={invitationUrl}>Review invitation</EmailButton>
          </Section>
          <FallbackLink href={invitationUrl} />
          <EmailNotice>
            Only accept this invitation if you know the sender and expect access to this
            organization.
          </EmailNotice>
        </EmailContent>
      </EmailLayout>
    </NameraEmail>
  );
};

OrganizationInvitationEmail.PreviewProps = {
  expiresAt: "2026-08-22T08:30:00.000Z",
  invitationUrl: "https://example.com/?invitation=example-invitation-id",
  inviterName: "Alice Chen",
  organizationName: "Atlas Labs",
  roleName: "Member",
} satisfies OrganizationInvitationEmailProps;

export default OrganizationInvitationEmail;
