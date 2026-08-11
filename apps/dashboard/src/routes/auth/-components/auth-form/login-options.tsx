import { Button, Typography } from "@namera-ai/ui";

type LoginOptionsProps = {
  onContinueWithEmail: () => void;
};

export function LoginOptions({ onContinueWithEmail }: LoginOptionsProps) {
  return (
    <div className="grid gap-4">
      <Typography.Heading className="mb-3 text-center text-balance text-xl" level={1}>
        Log in to Namera
      </Typography.Heading>

      <Button fullWidth onPress={onContinueWithEmail}>
        Continue with email
      </Button>
    </div>
  );
}
