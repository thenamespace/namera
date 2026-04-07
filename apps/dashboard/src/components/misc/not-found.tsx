import type { ReactNode } from "react";

import { NotFoundIcon } from "@namera-ai/ui/icons";

type NotFoundProps = {
  title?: ReactNode;
  description?: ReactNode;
  extraContent?: ReactNode;
};

export const NotFound = ({
  title,
  description,
  extraContent,
}: NotFoundProps) => {
  return (
    <div className="flex w-full items-center justify-center py-[40dvh] text-center">
      <div className="flex flex-col gap-4">
        <NotFoundIcon className="fill-accent-foreground mx-auto w-20" />
        <div className="flex flex-col">
          <h1 className="text-base font-medium">{title ?? "Not Found"}</h1>
          <p className="text-muted-foreground text-sm">
            {description ?? "The page you are looking for does not exist."}
          </p>
          {extraContent}
        </div>
      </div>
    </div>
  );
};
