import type { ReactNode } from "react";

import { Typography } from "@namera-ai/ui";

type DetailPropertyProps = {
  label: string;
  children: ReactNode;
  align?: "center" | "start";
};

export function DetailProperty({ label, children, align = "center" }: DetailPropertyProps) {
  return (
    <div
      className="grid min-h-9 grid-cols-[minmax(7rem,0.42fr)_minmax(0,1fr)] items-center gap-5 data-[align=start]:items-start sm:grid-cols-[11rem_minmax(0,1fr)]"
      data-align={align}
    >
      <Typography className="text-sm!" color="muted" weight="normal">
        {label}
      </Typography>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}
