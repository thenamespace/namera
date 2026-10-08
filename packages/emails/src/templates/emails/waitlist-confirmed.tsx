import type { WaitlistConfirmedEmailVariables } from "@namera-ai/protocol/model";
import { Text } from "react-email";

import { EmailAction } from "../components/action.js";
import { EmailContent } from "../components/content.js";
import { EmailLayout } from "../components/layout.js";
import { emailLinks } from "../data.js";
import { NameraEmail } from "../provider.js";

export type WaitlistConfirmedEmailProps = WaitlistConfirmedEmailVariables;

export const WaitlistConfirmedEmail = () => (
  <NameraEmail preview="Thanks for joining. We'll email you when your Namera invite is ready.">
    <EmailLayout>
      <EmailContent
        title="You're on the list"
        description="Thanks for your interest in Namera. Your place on the waitlist is confirmed."
      >
        <Text className="m-0 text-sm leading-6 text-email-light-muted dark:text-email-dark-muted">
          We'll email you when your invite is ready. There's nothing else you need to do for now.
        </Text>
        <EmailAction href={emailLinks.website.href}>Visit Namera</EmailAction>
      </EmailContent>
    </EmailLayout>
  </NameraEmail>
);

WaitlistConfirmedEmail.PreviewProps = {} satisfies WaitlistConfirmedEmailProps;

export default WaitlistConfirmedEmail;
