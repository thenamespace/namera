import type { ComponentProps, ReactNode } from "react";

import { Label, cn } from "@thenamespace/uikit";

export const FieldGroup = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("grid gap-4", className) ?? "grid gap-4"} {...props} />
);

export const Field = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("grid gap-2", className) ?? "grid gap-2"} {...props} />
);

export const FieldLabel = ({ className, ...props }: ComponentProps<typeof Label>) => (
  <Label className={cn("text-sm", className) ?? "text-sm"} {...props} />
);

type FieldErrorProps = Omit<ComponentProps<"p">, "children"> & {
  readonly children?: ReactNode;
  readonly errors?: ReadonlyArray<{ readonly message?: ReactNode } | undefined>;
};

export const FieldError = ({ children, errors, className, ...props }: FieldErrorProps) => {
  const messages = errors?.flatMap((error) =>
    error?.message === undefined ? [] : [error.message],
  );
  const content = children ?? messages?.[0];

  // React Hook Form owns validation here; React Aria's FieldError needs a
  // different validation context and silently hides these explicit messages.
  // A native paragraph avoids inheriting incompatible dialog/control text slots.
  return content === undefined || content === null ? null : (
    <p
      className={cn("text-danger text-xs leading-5", className) ?? "text-danger text-xs leading-5"}
      role="alert"
      {...props}
    >
      {content}
    </p>
  );
};
