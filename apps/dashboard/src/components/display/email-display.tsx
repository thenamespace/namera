import { useCallback } from "react";

import { Button, toast } from "@namera-ai/ui";

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
    <Button
      className="text-muted hover:text-foreground h-auto min-w-0 justify-start p-0"
      size="sm"
      type="button"
      variant="ghost"
      onPress={copyEmail}
    >
      <span className="truncate">{email}</span>
    </Button>
  );
}

export type { EmailDisplayProps };
