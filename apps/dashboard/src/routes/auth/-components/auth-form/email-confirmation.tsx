import { Button, Typography } from "@namera-ai/ui";

type EmailConfirmationProps = {
  email: string;
  onBack: () => void;
};

export function EmailConfirmation({ email, onBack }: EmailConfirmationProps) {
  return (
    <div className="text-center flex flex-col items-center justify-center">
      <Typography.Heading className="text-balance text-xl" level={1}>
        Check your email
      </Typography.Heading>
      <output className="mt-3 block">
        <Typography.Paragraph className="text-pretty" color="muted" size="sm">
          We've sent a temporary sign-in code to
          <span className="text-foreground mt-1 block text-center">{email}</span>
        </Typography.Paragraph>
      </output>

      <Button className="mt-8" fullWidth onPress={onBack} variant="tertiary">
        Back to login
      </Button>
    </div>
  );
}
