import type { ReactElement } from "react";

import type { SendEmailProps } from "#/types";

import { ApiKeyCreatedEmail } from "./emails/api-key-created.js";
import { ApiKeyRevokedEmail } from "./emails/api-key-revoked.js";
import { ConnectedAccountChangedEmail } from "./emails/connected-account-changed.js";
import { ExecutionConfirmedEmail } from "./emails/execution-confirmed.js";
import { MagicLinkEmail } from "./emails/magic-link.js";
import { NewSignInEmail } from "./emails/new-sign-in.js";
import { OrganizationInvitationEmail } from "./emails/organization-invitation.js";
import { PlatformInvitationEmail } from "./emails/platform-invitation.js";
import { SessionKeyCreatedEmail } from "./emails/session-key-created.js";
import { SessionKeyRevokedEmail } from "./emails/session-key-revoked.js";
import { WalletCreatedEmail } from "./emails/wallet-created.js";

export const renderEmail = (input: SendEmailProps): ReactElement => {
  switch (input.type) {
    case "platform-invitation":
      return <PlatformInvitationEmail {...input.variables} />;
    case "connected-account-changed":
      return <ConnectedAccountChangedEmail {...input.variables} />;
    case "magic-link":
      return <MagicLinkEmail {...input.variables} />;
    case "new-sign-in":
      return <NewSignInEmail {...input.variables} />;
    case "organization-invitation":
      return <OrganizationInvitationEmail {...input.variables} />;
    case "wallet-created":
      return <WalletCreatedEmail {...input.variables} />;
    case "session-key-created":
      return <SessionKeyCreatedEmail {...input.variables} />;
    case "session-key-revoked":
      return <SessionKeyRevokedEmail {...input.variables} />;
    case "api-key-created":
      return <ApiKeyCreatedEmail {...input.variables} />;
    case "api-key-revoked":
      return <ApiKeyRevokedEmail {...input.variables} />;
    case "execution-confirmed":
      return <ExecutionConfirmedEmail {...input.variables} />;
  }
};
