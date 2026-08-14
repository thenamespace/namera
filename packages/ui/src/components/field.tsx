import type { ComponentProps, ReactNode } from "react";

import { FieldError as UIKitFieldError, Label, cn } from "@thenamespace/uikit";

export const FieldGroup = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("grid gap-4", className) ?? "grid gap-4"} {...props} />
);

export const Field = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("grid gap-2", className) ?? "grid gap-2"} {...props} />
);

export const FieldLabel = ({ className, ...props }: ComponentProps<typeof Label>) => (
  <Label className={cn("text-sm", className) ?? "text-sm"} {...props} />
);

type FieldErrorProps = Omit<ComponentProps<typeof UIKitFieldError>, "children"> & {
  readonly children?: ReactNode;
  readonly errors?: ReadonlyArray<{ readonly message?: ReactNode } | undefined>;
};

export const FieldError = ({ children, errors, ...props }: FieldErrorProps) => {
  const messages = errors?.flatMap((error) =>
    error?.message === undefined ? [] : [error.message],
  );
  const content = children ?? messages?.[0];

  return content === undefined || content === null ? null : (
    <UIKitFieldError {...props}>{content}</UIKitFieldError>
  );
};
