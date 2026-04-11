import { createFileRoute, Link } from "@tanstack/react-router";

import { CaretLeftIcon } from "@phosphor-icons/react/dist/ssr";

import { PageHeader } from "@/app/dashboard/-components";
import { Button } from "@namera-ai/ui/components/ui/button";

import { NewAccountForm } from "../-components";

const Page = () => {
  return (
    <div>
      <PageHeader
        className="px-2 py-6"
        noBorder={true}
        header={
          <Button
            variant="ghost"
            size="xs"
            render={<Link to="/dashboard/accounts" />}
          >
            <CaretLeftIcon className="size-3" weight="bold" />
            Back
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-xl px-4 py-12">
        <NewAccountForm />
      </div>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/accounts/new/")({
  component: Page,
});
