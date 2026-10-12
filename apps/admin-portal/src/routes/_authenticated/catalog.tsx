import { createFileRoute } from "@tanstack/react-router";

import { currentAdminAtom } from "@/atoms/auth";
import { catalogAtom } from "@/atoms/catalog";
import { prefetchQuery } from "@/atoms/prefetch";
import { AdminPage } from "@/components/page";
import { hasPermissions, PermissionGuard, readCatalogPermission } from "@/components/permission";

import { CatalogTable } from "./-components/catalog/catalog-table";

const denied = <p className="text-muted text-sm">You do not have access to the address catalog.</p>;

export const Route = createFileRoute("/_authenticated/catalog")({
  loader: async ({ context, abortController }) => {
    const access = await prefetchQuery(
      context.atomRegistry,
      currentAdminAtom,
      abortController.signal,
    );
    if (
      access.status === "authorized" &&
      hasPermissions(access.admin.permissions, readCatalogPermission)
    ) {
      await prefetchQuery(context.atomRegistry, catalogAtom(), abortController.signal);
    }
  },
  component: () => (
    <AdminPage title="Catalog">
      <PermissionGuard required={readCatalogPermission} fallback={denied}>
        <CatalogTable />
      </PermissionGuard>
    </AdminPage>
  ),
});
