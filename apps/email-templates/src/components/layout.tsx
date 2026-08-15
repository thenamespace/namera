import type { PropsWithChildren } from "react";

import { Container, Hr, Section, Text } from "react-email";

import { NameraBrand } from "./brand.js";

export const EmailLayout = ({ children }: PropsWithChildren) => {
  return (
    <Section className="w-full bg-email-light-background dark:bg-email-dark-background">
      <Container className="mx-auto w-full max-w-[560px] px-5 py-10">
        <Section className="mb-6 px-1">
          <NameraBrand />
        </Section>

        <Section className="rounded-2xl border border-solid border-email-light-border bg-email-light-surface px-8 py-9 dark:border-email-dark-border dark:bg-email-dark-surface">
          {children}
        </Section>

        <Section className="px-4 pt-8 text-center">
          <Text className="m-0 text-xs leading-5 text-email-light-muted dark:text-email-dark-muted">
            This is a transactional email from Namera.
            <br />
            Never share a sign-in code with anyone.
          </Text>
          <Hr className="my-6 border-0 border-t border-solid border-email-light-border dark:border-email-dark-border" />
          <Text className="m-0 text-[11px] leading-4 text-email-light-muted dark:text-email-dark-muted">
            © {new Date().getUTCFullYear()} Namera
          </Text>
        </Section>
      </Container>
    </Section>
  );
};
