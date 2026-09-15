import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { NameraIcon } from "@namera-ai/ui/icons";
import { FormProvider, useForm } from "react-hook-form";
import { useEventCallback, useStep } from "usehooks-ts";

import { useRequestMagicLink } from "@/hooks/auth";
import { getErrorMessage } from "@/lib/error-messages";

import { AuthShell } from "../auth-shell";
import { EmailConfirmation } from "./email-confirmation";
import { EmailEntry } from "./email-entry";
import { LoginOptions } from "./login-options";
import { EmailFormValidator, type EmailFormInput, type EmailFormOutput } from "./schema";

const totalSteps = 3;

type AuthFormProps = {
  invite?: string | undefined;
  returnTo?: EmailFormOutput["returnTo"];
};

export function AuthForm({ returnTo, invite }: AuthFormProps) {
  const form = useForm<EmailFormInput, unknown, EmailFormOutput>({
    defaultValues: {
      email: "",
      ...(invite === undefined ? {} : { inviteCode: invite }),
      ...(returnTo === undefined ? {} : { returnTo }),
    },
    resolver: standardSchemaResolver(EmailFormValidator),
  });
  const [step, { goToNextStep, goToPrevStep, reset: resetStep }] = useStep(totalSteps);
  const requestMagicLink = useRequestMagicLink({
    onSuccess: () => goToNextStep(),
  });
  const continueWithEmail = useEventCallback((payload: EmailFormOutput) => {
    requestMagicLink.mutate({ payload });
  });

  const backToOptions = useEventCallback(() => {
    requestMagicLink.reset();
    goToPrevStep();
  });

  const backToLogin = useEventCallback(() => {
    requestMagicLink.reset();
    form.reset({
      email: "",
      ...(invite === undefined ? {} : { inviteCode: invite }),
      ...(returnTo === undefined ? {} : { returnTo }),
    });
    resetStep();
  });

  const content =
    step === 1 ? (
      <LoginOptions onContinueWithEmail={goToNextStep} />
    ) : step === 2 ? (
      <EmailEntry
        errorMessage={
          requestMagicLink.isError
            ? getErrorMessage(requestMagicLink.error, {
                title: "Couldn’t send the sign-in link",
                description: "Wait a moment, then try again.",
              }).description
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
