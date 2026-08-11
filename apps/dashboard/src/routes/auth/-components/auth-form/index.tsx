import { useState } from "react";

import { useEventCallback, useStep } from "usehooks-ts";

import { AuthShell } from "../auth-shell";
import { EmailConfirmation } from "./email-confirmation";
import { EmailEntry } from "./email-entry";
import { LoginOptions } from "./login-options";

const totalSteps = 3;

export function AuthForm() {
  const [email, setEmail] = useState("");
  const [step, { goToNextStep, goToPrevStep, reset }] = useStep(totalSteps);

  const continueWithEmail = useEventCallback((nextEmail: string) => {
    setEmail(nextEmail);
    goToNextStep();
  });

  const content =
    step === 1 ? (
      <LoginOptions onContinueWithEmail={goToNextStep} />
    ) : step === 2 ? (
      <EmailEntry onBack={goToPrevStep} onContinue={continueWithEmail} />
    ) : (
      <EmailConfirmation email={email} onBack={reset} />
    );

  return <AuthShell stepKey={`auth-step-${step}`}>{content}</AuthShell>;
}
