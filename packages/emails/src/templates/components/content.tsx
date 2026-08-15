import type { PropsWithChildren, ReactNode } from "react";

import { Heading, Section, Text } from "react-email";

type EmailContentProps = PropsWithChildren<{
  readonly description: ReactNode;
  readonly title: ReactNode;
}>;

export const EmailContent = ({ children, description, title }: EmailContentProps) => {
  return (
    <>
      <Heading
        as="h1"
        className="m-0 text-2xl font-semibold leading-8 tracking-[-0.5px] text-email-light-foreground dark:text-email-dark-foreground"
      >
        {title}
      </Heading>
      <Text className="mt-3 mb-0 text-sm leading-6 text-email-light-muted dark:text-email-dark-muted">
        {description}
      </Text>
      <Section className="mt-7">{children}</Section>
    </>
  );
};
