import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";

import { getTemplate } from "@namera-ai/templates";

import { currentUserAtom } from "@/atoms/auth/session";
import { billingAtom } from "@/atoms/billing";
import { prefetchQuery, startPrefetchQuery } from "@/atoms/prefetch";
import { walletsAtom } from "@/atoms/wallet";
import { DataError } from "@/components/data-error";
import { DataLoading } from "@/components/data-loading";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";
import { PermissionDenied } from "@/components/permission-denied";
import { CreateSessionKeyForm } from "@/components/session-key-creation";
import { useWallets } from "@/hooks/wallet";

export const Route = createFileRoute("/_authenticated/templates/$templateId")({
  loader: async ({ params, context, abortController }) => {
    const template = getTemplate(params.templateId);
    if (!template) throw notFound();
    const user = await prefetchQuery(context.atomRegistry, currentUserAtom, abortController.signal);
    if (!user) throw redirect({ to: "/auth", replace: true });
    const canCreate = hasPermissions(user.role.permissions, ["session-key:create"]);
    if (canCreate) startPrefetchQuery(context.atomRegistry, walletsAtom, abortController.signal);
    if (canCreate && hasPermissions(user.role.permissions, ["billing:read"]))
      startPrefetchQuery(context.atomRegistry, billingAtom, abortController.signal);
    return { templateId: template.id, canCreate };
  },
  component: TemplatePage,
});

function TemplatePage() {
  const { templateId, canCreate } = Route.useLoaderData();
  const template = getTemplate(templateId);
  if (!template) throw notFound();
  return (
    <DashboardPage>
      <DashboardPage.Header>
        <DashboardPage.Title>
          <Link to="/templates" className="text-muted hover:text-foreground">
            Templates
          </Link>
          <span className="text-muted">/</span>
          {template.display.name}
        </DashboardPage.Title>
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-12">
        {canCreate ? <TemplateWithAccounts templateId={templateId} /> : <PermissionDenied />}
      </DashboardPage.Content>
    </DashboardPage>
  );
}

function TemplateWithAccounts({ templateId }: { templateId: string }) {
  const wallets = useWallets();
  const template = getTemplate(templateId);
  if (!template) throw notFound();
  if (wallets.isError)
    return <DataError label="accounts" onRetry={wallets.refetch} isRetrying={wallets.isFetching} />;
  return wallets.data ? (
    <CreateSessionKeyForm key={templateId} template={template} wallets={wallets.data} />
  ) : (
    <DataLoading label="Loading accounts" />
  );
}
