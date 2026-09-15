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
          If this email has access, a sign-in link and email code are on their way to
          <span className="text-foreground mt-1 block text-center">{email}</span>
        </Typography.Paragraph>
      </output>
      <Typography.Paragraph className="mt-3" color="muted" size="sm">
        New members need a valid invite code. If no email arrives, go back and check your invite and
        email address.
      </Typography.Paragraph>

      <Button className="mt-8" fullWidth onPress={onBack} variant="tertiary">
        Back to login
      </Button>
    </div>
  );
}
