import type { PropsWithChildren } from "react";

import { Button } from "react-email";

type EmailButtonProps = PropsWithChildren<{
  readonly href: string;
}>;

export const EmailButton = ({ children, href }: EmailButtonProps) => {
  return (
    <Button
      className="box-border inline-block rounded-lg bg-email-accent px-6 py-3 text-center text-sm font-semibold leading-5 text-email-accent-foreground no-underline"
      href={href}
    >
      {children}
    </Button>
  );
};
