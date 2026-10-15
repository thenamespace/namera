import { createFileRoute } from "@tanstack/react-router";

import { interfacesAtom } from "@/atoms/interfaces";
import { prefetchAuthorizedQuery } from "@/atoms/prefetch";
import { AdminPage } from "@/components/page";
import { PermissionGuard, readCatalogPermission } from "@/components/permission";

import { InterfacesTable } from "./-components/interfaces/interfaces-table";

export const Route = createFileRoute("/_authenticated/interface")({
  loader: async ({ context, abortController }) => {
    await prefetchAuthorizedQuery(
      context.atomRegistry,
      readCatalogPermission,
      () => interfacesAtom(),
      abortController.signal,
    );
  },
  component: () => (
    <AdminPage title="Interfaces">
      <PermissionGuard required={readCatalogPermission}>
        <InterfacesTable />
      </PermissionGuard>
    </AdminPage>
  ),
});
