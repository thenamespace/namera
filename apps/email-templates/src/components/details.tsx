import type { PropsWithChildren, ReactNode } from "react";

import { Row, Section, Text } from "react-email";

export const EmailDetails = ({ children }: PropsWithChildren) => {
  return (
    <Section className="overflow-hidden rounded-xl border border-solid border-email-light-border bg-email-light-field dark:border-email-dark-border dark:bg-email-dark-field">
      {children}
    </Section>
  );
};

type EmailDetailProps = {
  readonly label: ReactNode;
  readonly value: ReactNode;
  readonly mono?: boolean;
};

export const EmailDetail = ({ label, mono = false, value }: EmailDetailProps) => {
  return (
    <Row className="border-0 border-b border-solid border-email-light-border px-5 py-3.5 last:border-b-0 dark:border-email-dark-border">
      <Text className="m-0 text-xs leading-5 text-email-light-muted dark:text-email-dark-muted">
        {label}
      </Text>
      <Text
        className={`m-0 mt-0.5 break-words text-sm leading-5 text-email-light-foreground dark:text-email-dark-foreground ${mono ? "font-mono" : "font-medium"}`}
      >
        {value}
      </Text>
    </Row>
  );
};
