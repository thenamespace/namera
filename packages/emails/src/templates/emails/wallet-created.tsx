// oxlint-disable react-perf/jsx-no-jsx-as-prop
import type { WalletCreatedEmailVariables } from "@namera-ai/protocol/model";
import { Img, Link } from "react-email";

import { EmailAction } from "../components/action.js";
import { EmailContent } from "../components/content.js";
import { EmailCustody } from "../components/custody.js";
import { EmailDetail, EmailDetails } from "../components/details.js";
import { EmailIdentity } from "../components/identity.js";
import { EmailLayout } from "../components/layout.js";
import { EmailNotice } from "../components/notice.js";
import { emailAssets } from "../data.js";
import { formatEvmAddress } from "../helpers/format.js";
import { NameraEmail } from "../provider.js";

export type WalletCreatedEmailProps = WalletCreatedEmailVariables;

export const WalletCreatedEmail = ({
  actionUrl,
  address,
  addressUrl,
  organizationName,
  ownership,
  custody,
  provider,
  walletName,
  walletLogo,
}: WalletCreatedEmailProps) => {
  const addressDisplay = formatEvmAddress(address);
  const implementationName = "Alchemy Modular V2";

  return (
    <NameraEmail preview={`${walletName} is ready in ${organizationName}.`}>
      <EmailLayout>
        <EmailContent
          description={`A new smart account was created in ${organizationName}.`}
          title="Smart account created"
        >
          <EmailDetails>
            <EmailDetail
              label="Account"
              value={<EmailIdentity name={walletName} logo={walletLogo} />}
            />
            <EmailDetail
              label="Namespace"
              value={
                <>
                  <Img
                    alt=""
                    src={emailAssets.chains.ethereum}
                    width="16"
                    height="16"
                    className="mr-2 inline-block align-middle"
                  />
                  EVM
                </>
              }
            />
            <EmailDetail
              label="Address"
              mono
              value={
                <Link className="text-email-accent underline" href={addressUrl}>
                  {addressDisplay}
                </Link>
              }
            />
            <EmailDetail
              label="Implementation"
              value={
                <>
                  <Img
                    alt=""
                    src={emailAssets.alchemy}
                    width="16"
                    height="16"
                    className="mr-2 inline-block align-middle"
                  />
                  {implementationName}
                </>
              }
            />
            <EmailDetail
              label="Ownership"
              value={
                <EmailCustody
                  custody={
                    custody ?? (ownership === "User-owned passkey" ? "local" : "namera-managed")
                  }
                  provider={provider}
                  label={provider === "1claw" ? "1Claw Managed" : ownership}
                />
              }
            />
          </EmailDetails>
          <EmailAction href={actionUrl}>View account</EmailAction>
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
  actionUrl: "https://dashboard.namera.ai/auth?returnTo=%2Faccount%2Fexample-account-id%2Foverview",
  address: "0x55d28BFdA5a7f4c828260F44638DE627cd2765Ff",
  addressUrl: "https://etherscan.io/address/0x55d28BFdA5a7f4c828260F44638DE627cd2765Ff",
  implementation: "alchemy-modular-v2",
  organizationName: "Atlas Labs",
  ownership: "1Claw Managed",
  custody: "namera-managed",
  provider: "1claw",
  namespace: "eip155",
  walletLogo: { type: "emoji", value: "💳" },
  walletName: "Treasury",
} satisfies WalletCreatedEmailProps;

export default WalletCreatedEmail;
