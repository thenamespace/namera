import { useCallback } from "react";

import { toast } from "@namera-ai/ui";

type EmailDisplayProps = {
  email: string;
};

export function EmailDisplay({ email }: EmailDisplayProps) {
  const copyEmail = useCallback(() => {
    void navigator.clipboard.writeText(email).then(
      () => toast.success("Email copied"),
      () => toast.danger("Couldn't copy email"),
    );
  }, [email]);

  return (
    <button
      className="text-muted hover:text-foreground h-auto min-w-0 justify-start p-0 cursor-pointer transition-all duration-100 ease-in-out"
      type="button"
      onClick={copyEmail}
    >
      <span className="truncate">{email}</span>
    </button>
  );
}

export type { EmailDisplayProps };
