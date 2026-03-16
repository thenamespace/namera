import { Button } from "@namera-ai/ui/components/ui/button";

type ConfirmStepProps = {
  onBack: () => void;
  email: string;
};

export const ConfirmStep = (props: ConfirmStepProps) => {
  return (
    <div className="w-full flex flex-col gap-3">
      <div className="text-lg text-card-foreground text-center">
        Check your email
      </div>
      <p className="text-sm text-center text-muted-foreground text-balance">
        We've sent you a temporary login link.
        <br />
        Please check your inbox at
        <br />
        <span className="font-medium text-white">{props.email}</span>
      </p>
      <Button
        className="w-full"
        onClick={props.onBack}
        size="lg"
        variant="secondary"
      >
        Back to sign in
      </Button>
    </div>
  );
};
