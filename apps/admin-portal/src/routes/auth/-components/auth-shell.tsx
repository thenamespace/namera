import type { PropsWithChildren } from "react";

import { NameraIcon } from "@namera-ai/ui/icons";
import { TransitionWrapper } from "@namera-ai/ui/transition";

export function AuthShell({ children, stepKey }: PropsWithChildren<{ stepKey: string }>) {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-xs">
        <TransitionWrapper stepKey={stepKey}>
          <NameraIcon aria-hidden="true" className="fill-foreground mx-auto mb-10 h-10 w-auto" />
          {children}
        </TransitionWrapper>
      </div>
    </main>
  );
}
