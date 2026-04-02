import { Link } from "@tanstack/react-router";

import { Button } from "@namera-ai/ui/components/ui/button";
import { NameraIcon } from "@namera-ai/ui/icons";
import { usePostHog } from "@posthog/react";

export const CallToAction = () => {
  const posthog = usePostHog();

  return (
    <section
      className="relative mx-auto h-120 flex flex-col items-center justify-center gap-4"
      id="cta"
      style={{
        backgroundImage: "url(/assets/flare.jpg)",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
        backgroundSize: "auto 100%",
      }}
    >
      <div className="flex flex-row items-center gap-2">
        <NameraIcon className="size-5 fill-white" />
        <div className="text-white text-2xl">Namera</div>
      </div>
      <h2 className="text-[1.75rem] md:text-[2.5rem] font-medium heading-gradient pb-2 leading-[1.1]">
        Start building with Namera
      </h2>
      <p className="text-center text-neutral-200 max-w-sm md:max-w-md w-full">
        Build and control programmable wallets with session keys, permissions,
        and agent-driven execution.
      </p>
      <div className="flex flex-row items-center gap-4 pt-4">
        <Button
          className="cta-button px-4"
          nativeButton={false}
          render={
            <Link
              onClick={() =>
                posthog.capture("cta_get_started_clicked", {
                  location: "cta",
                })
              }
              params={{}}
              to="/docs/$"
            />
          }
          size="lg"
        >
          Get Started
        </Button>
      </div>
    </section>
  );
};
