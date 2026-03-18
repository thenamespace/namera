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
    <div className="w-full flex justify-center items-center text-center py-[40dvh]">
      <div className="flex flex-col gap-4">
        <NotFoundIcon className="w-20 mx-auto" />
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{title ?? "Not Found"}</h1>
          <p className="text-sm">
            {description ?? "The page you are looking for does not exist."}
          </p>
          {extraContent}
        </div>
      </div>
    </div>
  );
};
