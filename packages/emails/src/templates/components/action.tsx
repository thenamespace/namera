import type { PropsWithChildren } from "react";

import { Section } from "react-email";

import { EmailButton } from "./button.js";

export const EmailAction = ({
  children,
  href,
}: PropsWithChildren<{ href: string | undefined }>) => {
  // Jobs queued before dashboard actions were added still need to render.
  if (href === undefined) return null;

  return (
    <Section className="mt-7">
      <EmailButton href={href}>{children}</EmailButton>
    </Section>
  );
};
