import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { NameraIcon } from "@namera-ai/ui/icons";
import { FormProvider, useForm } from "react-hook-form";
import { useEventCallback, useStep } from "usehooks-ts";

import { useRequestMagicLink } from "@/hooks/auth";

import { AuthShell } from "../auth-shell";
import { EmailConfirmation } from "./email-confirmation";
import { EmailEntry } from "./email-entry";
import { LoginOptions } from "./login-options";
import { EmailFormValidator, type EmailFormInput, type EmailFormOutput } from "./schema";

const totalSteps = 3;

export function AuthForm() {
  const form = useForm<EmailFormInput, unknown, EmailFormOutput>({
    defaultValues: { email: "" },
    resolver: standardSchemaResolver(EmailFormValidator),
  });
  const [step, { goToNextStep, goToPrevStep, reset: resetStep }] = useStep(totalSteps);
  const requestMagicLink = useRequestMagicLink();

  const continueWithEmail = useEventCallback(async (nextEmail: EmailFormOutput["email"]) => {
    try {
      await requestMagicLink.mutateAsync({ payload: { email: nextEmail } });
      goToNextStep();
    } catch {
      return;
    }
  });

  const backToOptions = useEventCallback(() => {
    requestMagicLink.reset();
    goToPrevStep();
  });

  const backToLogin = useEventCallback(() => {
    requestMagicLink.reset();
    form.reset();
    resetStep();
  });

  const content =
    step === 1 ? (
      <LoginOptions onContinueWithEmail={goToNextStep} />
    ) : step === 2 ? (
      <EmailEntry
        errorMessage={
          requestMagicLink.isError
            ? "Couldn't send the link. Wait a moment and try again."
            : undefined
        }
        isPending={requestMagicLink.isPending}
        onBack={backToOptions}
        onContinue={continueWithEmail}
      />
    ) : (
      <EmailConfirmation email={form.getValues("email")} onBack={backToLogin} />
    );

  return (
    <FormProvider {...form}>
      <AuthShell stepKey={`auth-step-${step}`}>
        <NameraIcon aria-hidden="true" className="fill-foreground mx-auto mb-10 h-10 w-auto" />
        {content}
      </AuthShell>
    </FormProvider>
  );
}
