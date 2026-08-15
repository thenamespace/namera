import type { ReactNode } from "react";

import { Section, Text } from "react-email";

type EmailNoticeProps = {
  readonly children: ReactNode;
};

export const EmailNotice = ({ children }: EmailNoticeProps) => {
  return (
    <Section className="mt-7 rounded-xl border border-solid border-email-light-border px-5 py-4 dark:border-email-dark-border">
      <Text className="m-0 text-xs leading-5 text-email-light-muted dark:text-email-dark-muted">
        {children}
      </Text>
    </Section>
  );
};
