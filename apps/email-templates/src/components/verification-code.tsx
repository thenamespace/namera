import { Section, Text } from "react-email";

type VerificationCodeProps = {
  readonly code: string;
};

export const VerificationCode = ({ code }: VerificationCodeProps) => {
  return (
    <Section className="rounded-xl bg-email-light-field px-5 py-4 text-center dark:bg-email-dark-field">
      <Text className="m-0 text-[11px] font-medium uppercase tracking-[1.4px] text-email-light-muted dark:text-email-dark-muted">
        Sign-in code
      </Text>
      <Text className="m-0 mt-2 font-mono text-2xl font-semibold tracking-[5px] text-email-light-foreground dark:text-email-dark-foreground">
        {code}
      </Text>
    </Section>
  );
};
