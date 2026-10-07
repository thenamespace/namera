import { Button, Typography } from "@namera-ai/ui";

import { useGoogleConfiguration, useStartGoogle } from "@/hooks/auth/google";
import { showErrorToast } from "@/lib/toasts";

type LoginOptionsProps = {
  onContinueWithEmail: () => void;
  returnTo?: string | undefined;
  invite?: string | undefined;
};

export function LoginOptions({ onContinueWithEmail, returnTo, invite }: LoginOptionsProps) {
  const configuration = useGoogleConfiguration();
  const start = useStartGoogle({
    onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl),
    onError: (error) => showErrorToast(error, { title: "Couldn’t start Google sign-in" }),
  });
  const continueWithGoogle = useCallback(() => {
    start.mutate({
      payload: {
        ...(returnTo ? { returnTo } : {}),
        ...(invite ? { inviteCode: invite } : {}),
      },
    });
  }, [start, returnTo, invite]);
  return (
    <div className="grid gap-4">
      <Typography.Heading
        className="mb-3 text-center text-balance text-xl"
        level={1}
        weight="medium"
      >
        Log in to Namera
      </Typography.Heading>

      {configuration.data?.enabled ? (
        <Button fullWidth isPending={start.isPending} onPress={continueWithGoogle}>
          Continue with Google
        </Button>
      ) : null}
      <Button
        fullWidth
        variant={configuration.data?.enabled ? "secondary" : "primary"}
        isDisabled={start.isPending}
        onPress={onContinueWithEmail}
      >
        Continue with email
      </Button>
    </div>
  );
}
import { useCallback } from "react";
