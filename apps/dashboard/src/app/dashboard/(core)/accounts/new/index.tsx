import { createFileRoute, Link } from "@tanstack/react-router";

import { CaretLeftIcon } from "@phosphor-icons/react/dist/ssr";

import { PageHeader } from "@/app/dashboard/-components";
import { Button } from "@namera-ai/ui/components/ui/button";

const Page = () => {
  return (
    <div>
      <PageHeader
        className="px-2 py-6"
        noBorder={true}
        header={
          <Button
            variant="ghost"
            size="sm"
            className="w-fit rounded-full"
            render={<Link to="/dashboard/accounts" />}
          >
            <CaretLeftIcon className="size-3" weight="bold" />
            Back
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        {/* <NewAccountForm /> */}
      </div>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/(core)/accounts/new/")({
  component: Page,
});
