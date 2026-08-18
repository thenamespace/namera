import type { ReactNode } from "react";

import { Tooltip } from "@namera-ai/ui";

import { TableFilterMenu, type TableFilterMenuProps } from "./filter-menu";

type TableControlsProps = {
  children: ReactNode;
};

export function TableControls({ children }: TableControlsProps) {
  return <div className="flex items-center gap-1.5">{children}</div>;
}

export function TableFilterControl(props: TableFilterMenuProps) {
  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger className="inline-flex">
        <span className="inline-flex">
          <TableFilterMenu {...props} />
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content showArrow>
        <Tooltip.Arrow />
        Apply filters
      </Tooltip.Content>
    </Tooltip>
  );
}

export type { TableControlsProps };
