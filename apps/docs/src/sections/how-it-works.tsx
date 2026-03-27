import type { ComponentProps, ReactNode, SVGProps } from "react";

import { cn } from "@namera-ai/ui/lib/utils";
import {
  CurrencyEthIcon,
  KeyIcon,
  TerminalIcon,
  WalletIcon,
} from "@phosphor-icons/react";

import { Hr } from "@/components/misc";

type Step = {
  description: string;
  icon: (props: SVGProps<SVGSVGElement>) => ReactNode;
  title: string;
};

const createStep = {
  description:
    "Initialize a smart account, enabling agents to interact securely without exposing private keys",
  icon: WalletIcon,
  title: "Create smart wallet account",
};

const sessionKeyStep = {
  description:
    "Set rules for allowed actions, limits, and conditions, then issue scoped session access tailored for specific agents",
  icon: KeyIcon,
  title: "Define permissions",
};

const mcpStep = {
  description:
    "Agents trigger transactions through MCP or local CLI, operating within defined rules and executing actions automatically",
  icon: TerminalIcon,
  title: "Agents execute via MCP or CLI",
};

const onchainStep = {
  description:
    "All transactions are validated against defined rules during execution, ensuring every action follows enforced constraints onchain",
  icon: CurrencyEthIcon,
  title: "Execution enforced directly onchain",
};

export const HowItWorks = () => {
  return (
    <>
      <Hr />
      <section
        className="px-4 max-w-7xl mx-auto my-24 flex flex-col gap-12"
        id="how-it-works"
      >
        <div className="flex flex-col gap-2">
          <h2 className="font-helveticaDisplay text-3xl sm:text-4xl heading-gradient text-center pb-2">
            How Namera powers
            <br />
            agent wallets
          </h2>
          <p className="text-center max-w-sm mx-auto text-neutral-200">
            From setup to execution, everything needed to run autonomous wallet
            systems
          </p>
        </div>
        <div className="flex flex-row gap-4 justify-between relative">
          <StepCard
            className="lg:flex absolute top-0 left-0 hidden"
            step={createStep}
          />
          <StepCard
            className="lg:flex absolute hidden top-1/2 left-0"
            step={sessionKeyStep}
          />
          <StepCard
            className="lg:flex absolute hidden top-0 right-0"
            step={mcpStep}
          />
          <StepCard
            className="lg:flex absolute hidden top-1/2 right-0"
            step={onchainStep}
          />
          <img
            alt=""
            className="max-w-6xl w-full aspect-video mx-auto"
            src="/assets/how-it-works.png"
          />
        </div>
        <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4 borer place-items-center">
          <StepCard step={createStep} />
          <StepCard step={sessionKeyStep} />
          <StepCard step={mcpStep} />
          <StepCard step={onchainStep} />
        </div>
      </section>
      <Hr />
    </>
  );
};

type StepCardProps = ComponentProps<"div"> & { step: Step };

const StepCard = ({ step, className, ...props }: StepCardProps) => {
  return (
    <div
      className={cn("flex flex-col gap-2 max-w-[18rem]", className)}
      {...props}
    >
      <div className="size-10 border rounded-xl flex justify-center items-center">
        <div className="size-8.5 bg-[#0F101A] border rounded-[10px] flex items-center justify-center ">
          <step.icon className="text-accent-foreground size-5" />
        </div>
      </div>
      <div>{step.title}</div>
      <p className="text-neutral-200 font-light text-sm">{step.description}</p>
    </div>
  );
};
