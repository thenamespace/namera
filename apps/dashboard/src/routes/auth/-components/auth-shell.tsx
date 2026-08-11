import type { PropsWithChildren } from "react";

import { TransitionWrapper } from "@/components/wrappers/transition";

type AuthShellProps = PropsWithChildren<{
  stepKey: string;
}>;

export function AuthShell({ children, stepKey }: AuthShellProps) {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-xs">
        <TransitionWrapper stepKey={stepKey}>{children}</TransitionWrapper>
      </div>
    </main>
  );
}
