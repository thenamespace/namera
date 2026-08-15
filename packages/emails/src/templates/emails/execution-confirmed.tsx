// oxlint-disable react-perf/jsx-no-jsx-as-prop
import type { ExecutionConfirmedEmailVariables } from "@namera-ai/protocol/model";
import { Img, Link } from "react-email";

import { EmailContent } from "../components/content.js";
import { EmailDetail, EmailDetails } from "../components/details.js";
import { EmailLayout } from "../components/layout.js";
import { EmailNotice } from "../components/notice.js";
import { emailAssets } from "../data.js";
import { formatTransactionHash } from "../helpers/format.js";
import { NameraEmail } from "../provider.js";

export type ExecutionConfirmedEmailProps = ExecutionConfirmedEmailVariables;

export const ExecutionConfirmedEmail = ({
  chainIcon,
  chainName,
  organizationName,
  transactionHash,
  transactionUrl,
  walletName,
}: ExecutionConfirmedEmailProps) => {
  const transactionHashDisplay = formatTransactionHash(transactionHash);

  return (
    <NameraEmail preview={`An execution from ${walletName} was confirmed onchain.`}>
      <EmailLayout>
        <EmailContent
          description={`An execution from ${walletName} in ${organizationName} was confirmed onchain.`}
          title="Execution confirmed"
        >
          <EmailDetails>
            <EmailDetail label="Account" value={walletName} />
            <EmailDetail
              label="Chain"
              value={
                <>
                  <Img
                    alt={chainName}
                    className="mr-2 inline-block align-middle"
                    height={20}
                    src={emailAssets.chains[chainIcon]}
                    width={20}
                  />
                  <span className="align-middle">{chainName}</span>
                </>
              }
            />
            <EmailDetail
              label="Transaction"
              mono
              value={
                <Link className="text-email-accent underline" href={transactionUrl}>
                  {transactionHashDisplay}
                </Link>
              }
            />
          </EmailDetails>
          <EmailNotice>
            This transaction passed the session-key policies and authorization configured for the
            requesting actor.
          </EmailNotice>
        </EmailContent>
      </EmailLayout>
    </NameraEmail>
  );
};

ExecutionConfirmedEmail.PreviewProps = {
  chainId: "eip155:11155111",
  chainName: "Sepolia",
  chainIcon: "ethereum",
  organizationName: "Atlas Labs",
  transactionHash: "0x5220eca56a1918b04ebd0a4ca0f460f0e72dbcf639e00f9f8b5f6b5cb5365f86",
  transactionUrl:
    "https://sepolia.etherscan.io/tx/0x5220eca56a1918b04ebd0a4ca0f460f0e72dbcf639e00f9f8b5f6b5cb5365f86",
  walletName: "Treasury",
} satisfies ExecutionConfirmedEmailProps;

export default ExecutionConfirmedEmail;
