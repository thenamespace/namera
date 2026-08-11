import type { PropsWithChildren } from "react";

import { NameraIcon } from "@namera-ai/ui/icons";

import { TransitionWrapper } from "@/components/transition-wrapper";

type AuthShellProps = PropsWithChildren<{
  stepKey: string;
}>;

export function AuthShell({ children, stepKey }: AuthShellProps) {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <NameraIcon aria-hidden="true" className="fill-foreground mx-auto mb-10 h-10 w-auto" />
        <TransitionWrapper stepKey={stepKey}>{children}</TransitionWrapper>
      </div>
    </main>
  );
}
