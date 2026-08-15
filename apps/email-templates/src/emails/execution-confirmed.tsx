import type { ExecutionConfirmedEmailVariables } from "@namera-ai/protocol/model";

import { EmailContent } from "../components/content.js";
import { EmailDetail, EmailDetails } from "../components/details.js";
import { EmailLayout } from "../components/layout.js";
import { EmailNotice } from "../components/notice.js";
import { NameraEmail } from "../provider.js";

export type ExecutionConfirmedEmailProps = ExecutionConfirmedEmailVariables;

export const ExecutionConfirmedEmail = ({
  chainId,
  organizationName,
  transactionHash,
  walletName,
}: ExecutionConfirmedEmailProps) => {
  return (
    <NameraEmail preview={`An execution from ${walletName} was confirmed onchain.`}>
      <EmailLayout>
        <EmailContent
          description={`An execution from ${walletName} in ${organizationName} was confirmed onchain.`}
          title="Execution confirmed"
        >
          <EmailDetails>
            <EmailDetail label="Account" value={walletName} />
            <EmailDetail label="Chain" mono value={chainId} />
            <EmailDetail label="Transaction hash" mono value={transactionHash} />
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
  organizationName: "Atlas Labs",
  transactionHash: "0x5220eca56a1918b04ebd0a4ca0f460f0e72dbcf639e00f9f8b5f6b5cb5365f86",
  walletName: "Treasury",
} satisfies ExecutionConfirmedEmailProps;

export default ExecutionConfirmedEmail;
