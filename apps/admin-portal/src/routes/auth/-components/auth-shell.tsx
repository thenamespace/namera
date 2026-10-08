import type { PropsWithChildren } from "react";

import { NameraIcon } from "@namera-ai/ui/icons";

export function AuthShell({ children }: PropsWithChildren) {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-xs">
        <NameraIcon aria-hidden="true" className="fill-foreground mx-auto mb-10 h-10 w-auto" />
        {children}
      </div>
    </main>
  );
}
