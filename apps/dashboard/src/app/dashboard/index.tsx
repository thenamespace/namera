import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@namera-ai/ui/components/ui/button";
import { Effect } from "effect";

import { ApiClient } from "@/layers/api";
import { clientRuntime } from "@/runtime/client";
import { listSmartAccounts } from "@/server/actions";

import { PageHeader } from "./-components";

const DashboardPage = () => {
  const getAccounts = useServerFn(listSmartAccounts);
  const accounts = useLoaderData({ from: "/dashboard" });

  return (
    <div>
      <PageHeader header="Dashboard" />
      {JSON.stringify(accounts)}
      <Button
        onClick={async () => {
          const program = Effect.gen(function* () {
            const api = yield* ApiClient;

            const res = yield* api.smartAccount.list();
            return res;
          });

          const accounts = clientRuntime.runPromise(program);
          console.log(accounts);
        }}
      >
        Get Accounts Client
      </Button>
      <Button
        onClick={async () => {
          const res = await getAccounts();
          console.log(res);
        }}
      >
        Get Accounts Server
      </Button>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/")({
  component: DashboardPage,
  errorComponent: () => <div>Some Error Occurred in dashboard</div>,
});
