import { createFileRoute } from "@tanstack/react-router";

import { catalogAtom } from "@/atoms/catalog";
import { prefetchAuthorizedQuery } from "@/atoms/prefetch";
import { AdminPage } from "@/components/page";
import { PermissionGuard, readCatalogPermission } from "@/components/permission";

import { CatalogTable } from "./-components/catalog/catalog-table";

const denied = <p className="text-muted text-sm">You do not have access to the address catalog.</p>;

export const Route = createFileRoute("/_authenticated/catalog")({
  loader: async ({ context, abortController }) => {
    await prefetchAuthorizedQuery(
      context.atomRegistry,
      readCatalogPermission,
      () => catalogAtom(),
      abortController.signal,
    );
  },
  component: () => (
    <AdminPage title="Catalog">
      <PermissionGuard required={readCatalogPermission} fallback={denied}>
        <CatalogTable />
      </PermissionGuard>
    </AdminPage>
  ),
});
