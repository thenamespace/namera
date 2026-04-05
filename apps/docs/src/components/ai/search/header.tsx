import type { ComponentProps } from "react";

import { Button } from "@namera-ai/ui/components/ui/button";
import { cn } from "@namera-ai/ui/lib/utils";
import { CaretDoubleRightIcon } from "@phosphor-icons/react";

import { useAISearchContext } from "./context";

export const AISearchPanelHeader = ({
  className,
  ...props
}: ComponentProps<"div">) => {
  const { setOpen } = useAISearchContext();

  return (
    <div
      className={cn(
        "sticky top-0 flex items-center gap-2 justify-between px-1",
        className,
      )}
      {...props}
    >
      <div className="font-medium text-sm">Ask AI</div>
      <Button onClick={() => setOpen(false)} size="icon-sm" variant="muted">
        <CaretDoubleRightIcon className="size-4" />
      </Button>
    </div>
  );
};
