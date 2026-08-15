import type { WalletCreatedEmailVariables } from "@namera-ai/protocol/model";

import { EmailContent } from "../components/content.js";
import { EmailDetail, EmailDetails } from "../components/details.js";
import { EmailLayout } from "../components/layout.js";
import { EmailNotice } from "../components/notice.js";
import { NameraEmail } from "../provider.js";

export type WalletCreatedEmailProps = WalletCreatedEmailVariables;

export const WalletCreatedEmail = ({
  address,
  implementation,
  organizationName,
  protectionLevel,
  walletName,
}: WalletCreatedEmailProps) => {
  return (
    <NameraEmail preview={`${walletName} is ready in ${organizationName}.`}>
      <EmailLayout compactOnMobile>
        <EmailContent
          description={`A new smart account was created in ${organizationName}.`}
          title="Smart account created"
        >
          <EmailDetails>
            <EmailDetail label="Account" value={walletName} />
            <EmailDetail label="Address" mono value={address} />
            <EmailDetail
              label="Implementation"
              value={implementation === "kernel" ? "Kernel" : "Safe"}
            />
            <EmailDetail
              label="Key protection"
              value={protectionLevel === "hsm" ? "HSM" : "Software"}
            />
          </EmailDetails>
          <EmailNotice>
            Namera will enforce organization permissions and session-key policies before this
            account can be used by an agent.
          </EmailNotice>
        </EmailContent>
      </EmailLayout>
    </NameraEmail>
  );
};

WalletCreatedEmail.PreviewProps = {
  address: "0x55d28BFdA5a7f4c828260F44638DE627cd2765Ff",
  implementation: "kernel",
  organizationName: "Atlas Labs",
  protectionLevel: "software",
  walletName: "Treasury",
} satisfies WalletCreatedEmailProps;

export default WalletCreatedEmail;
