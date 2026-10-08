import type { ReactNode } from "react";

import { Sidebar, Typography } from "@namera-ai/ui";

export function AdminPage({
  title,
  children,
}: {
  readonly title: string;
  readonly children?: ReactNode;
}) {
  return (
    <Sidebar.Main className="bg-background min-w-0 rounded-lg">
      <header className="flex items-center gap-2 px-4 py-3">
        <Sidebar.Trigger aria-label="Toggle sidebar" className="max-md:min-h-11 max-md:min-w-11" />
        <Typography.Heading level={1} weight="normal" className="text-sm">
          {title}
        </Typography.Heading>
      </header>
      <div className="p-4">
        {children ?? <p className="text-muted text-sm">This page is not implemented yet.</p>}
      </div>
    </Sidebar.Main>
  );
}
