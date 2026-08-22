import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { Schema } from "effect";

import { ExecutionId } from "@namera-ai/protocol";

import { executionAtom } from "@/atoms/execution";
import { startPrefetchQuery } from "@/atoms/prefetch";
import { DataLoading } from "@/components/data-loading";
import { ExecutionDetails } from "@/components/execution-details";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { useExecution } from "@/hooks/execution";

export const Route = createFileRoute("/_authenticated/execution/$executionId")({
  loader: ({ abortController, context, params }) => {
    if (!Schema.is(ExecutionId)(params.executionId)) throw notFound();

    startPrefetchQuery(
      context.atomRegistry,
      executionAtom(params.executionId),
      abortController.signal,
    );
    return { executionId: params.executionId };
  },
  component: ExecutionPage,
});

function ExecutionPage() {
  const { executionId } = Route.useLoaderData();
  const execution = useExecution(executionId);

  return (
    <DashboardPage>
      <DashboardPage.Header>
        <DashboardPage.Title>
          <Link className="text-muted transition-colors hover:text-foreground" to="/activity">
            Activity
          </Link>
          <span aria-hidden className="text-muted">
            /
          </span>
          <HeadingGroup.Title className="truncate text-sm" level={1} weight="normal">
            Execution
          </HeadingGroup.Title>
        </DashboardPage.Title>
      </DashboardPage.Header>
      <DashboardPage.Content className="w-full px-4 py-6 sm:px-6">
        {execution.data ? (
          <ExecutionDetails details={execution.data} />
        ) : (
          <DataLoading className="min-h-64" label="Loading execution" />
        )}
      </DashboardPage.Content>
    </DashboardPage>
  );
}
