import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { Schema } from "effect";

import { ExecutionId, ExecutionNotFoundError } from "@namera-ai/protocol";

import { executionAtom } from "@/atoms/execution";
import { prefetchQuery } from "@/atoms/prefetch";
import { ExecutionDetails } from "@/components/execution-details";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";

export const Route = createFileRoute("/_authenticated/execution/$executionId")({
  loader: async ({ abortController, context, params }) => {
    if (!Schema.is(ExecutionId)(params.executionId)) throw notFound();

    try {
      const execution = await prefetchQuery(
        context.atomRegistry,
        executionAtom(params.executionId),
        abortController.signal,
      );
      return { execution };
    } catch (error) {
      if (Schema.is(ExecutionNotFoundError)(error)) throw notFound();
      throw error;
    }
  },
  component: ExecutionPage,
});

function ExecutionPage() {
  const { execution } = Route.useLoaderData();

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
          <HeadingGroup.Title className="truncate text-base" level={1} weight="normal">
            Execution
          </HeadingGroup.Title>
        </DashboardPage.Title>
      </DashboardPage.Header>
      <DashboardPage.Content className="w-full px-4 py-6 sm:px-6">
        <ExecutionDetails details={execution} />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
