import type { ComponentProps } from "react";

import { cn } from "@namera-ai/ui";

export const PageGradient = ({ children, className, ...props }: ComponentProps<"div">) => {
  return (
    <div
      className={cn("bg-[linear-gradient(180deg,#111212_0%,#09090a_50%)]", className)}
      {...props}
    >
      {children}
    </div>
  );
};
