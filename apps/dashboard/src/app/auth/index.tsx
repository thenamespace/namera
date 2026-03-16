import { useState } from "react";

import { createFileRoute, redirect } from "@tanstack/react-router";

import { NameraIcon } from "@namera-ai/ui/icons";
import { useStep } from "usehooks-ts";

import { TransitionWrapper } from "@/components/wrappers";
import { getCurrentUser } from "@/server/actions";

import { ConfirmStep, MagicLinkForm } from "./-components";

const AuthPage = () => {
  const [email, setEmail] = useState("");
  const [currentStep, actions] = useStep(2);

  return (
    <div className="flex items-center justify-center pt-[30dvh]">
      <div className="flex flex-col gap-6 justify-between items-center max-w-xs w-full">
        <NameraIcon className="size-14 fill-foreground" />
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
  beforeLoad: async () => {
    const currentUser = await getCurrentUser();
    if (currentUser) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthPage,
});
