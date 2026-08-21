// oxlint-disable react-perf/jsx-no-jsx-as-prop
import type { WalletCreatedEmailVariables } from "@namera-ai/protocol/model";
import { Link } from "react-email";

import { EmailContent } from "../components/content.js";
import { EmailDetail, EmailDetails } from "../components/details.js";
import { EmailLayout } from "../components/layout.js";
import { EmailNotice } from "../components/notice.js";
import { formatEvmAddress } from "../helpers/format.js";
import { NameraEmail } from "../provider.js";

export type WalletCreatedEmailProps = WalletCreatedEmailVariables;

export const WalletCreatedEmail = ({
  address,
  addressUrl,
  organizationName,
  protectionLevel,
  walletName,
}: WalletCreatedEmailProps) => {
  const addressDisplay = formatEvmAddress(address);
  const implementationName = "Alchemy Modular V2";
  const protectionLevelName = protectionLevel === "hsm" ? "HSM" : "Software";

  return (
    <NameraEmail preview={`${walletName} is ready in ${organizationName}.`}>
      <EmailLayout>
        <EmailContent
          description={`A new smart account was created in ${organizationName}.`}
          title="Smart account created"
        >
          <EmailDetails>
            <EmailDetail label="Account" value={walletName} />
            <EmailDetail
              label="Address"
              mono
              value={
                <Link className="text-email-accent underline" href={addressUrl}>
                  {addressDisplay}
                </Link>
              }
            />
            <EmailDetail label="Implementation" value={implementationName} />
            <EmailDetail label="Key protection" value={protectionLevelName} />
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
  addressUrl: "https://etherscan.io/address/0x55d28BFdA5a7f4c828260F44638DE627cd2765Ff",
  implementation: "alchemy-modular-v2",
  organizationName: "Atlas Labs",
  protectionLevel: "software",
  walletName: "Treasury",
} satisfies WalletCreatedEmailProps;

export default WalletCreatedEmail;
