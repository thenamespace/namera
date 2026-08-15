import { Link, Text } from "react-email";

type FallbackLinkProps = {
  readonly href: string;
};

export const FallbackLink = ({ href }: FallbackLinkProps) => {
  return (
    <Text className="mt-7 mb-0 text-xs leading-5 text-email-light-muted dark:text-email-dark-muted">
      If the button does not work, copy and paste this link into your browser:
      <br />
      <Link className="break-all text-email-accent underline" href={href}>
        {href}
      </Link>
    </Text>
  );
};
