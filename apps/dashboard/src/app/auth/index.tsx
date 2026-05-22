import { useState } from "react";

import { createFileRoute, redirect } from "@tanstack/react-router";

import { useStep } from "usehooks-ts";

import { TransitionWrapper } from "@/components/wrappers";
import { queries } from "@/lib/query";
import { NameraIcon } from "@namera-ai/ui/icons";

import { ConfirmStep, MagicLinkForm } from "./-components";

const AuthPage = () => {
  const [email, setEmail] = useState("");
  const [currentStep, actions] = useStep(2);

  return (
    <div className="flex items-center justify-center pt-[30dvh]">
      <div className="flex w-full max-w-xs flex-col items-center justify-between gap-6">
        <NameraIcon className="fill-foreground size-14" />
        <TransitionWrapper
          className="w-full px-2"
          stepKey={`auth-step-${currentStep}`}
        >
          {currentStep === 1 && (
            <MagicLinkForm
              onSubmit={(v) => {
                setEmail(v.email);
                actions.goToNextStep();
              }}
            />
          )}
          {currentStep === 2 && (
            <ConfirmStep email={email} onBack={actions.goToPrevStep} />
          )}
        </TransitionWrapper>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/auth/")({
  beforeLoad: async ({ context }) => {
    const currentUser = await context.queryClient.ensureQueryData(
      queries.auth.me,
    );

    if (currentUser?.organization) {
      throw redirect({ to: "/dashboard" });
    }

    if (currentUser) {
      throw redirect({ to: "/workspace/new" });
    }
  },
  component: AuthPage,
});
