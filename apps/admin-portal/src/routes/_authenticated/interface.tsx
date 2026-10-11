import { createFileRoute } from "@tanstack/react-router";

import { currentAdminAtom } from "@/atoms/auth";
import { interfacesAtom } from "@/atoms/interfaces";
import { prefetchQuery } from "@/atoms/prefetch";
import { AdminPage } from "@/components/page";
import { hasPermissions, PermissionGuard, readCatalogPermission } from "@/components/permission";

import { InterfacesTable } from "./-components/interfaces/interfaces-table";

export const Route = createFileRoute("/_authenticated/interface")({
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
      await prefetchQuery(context.atomRegistry, interfacesAtom(), abortController.signal);
    }
  },
  component: () => (
    <AdminPage title="Interfaces">
      <PermissionGuard required={readCatalogPermission}>
        <InterfacesTable />
      </PermissionGuard>
    </AdminPage>
  ),
});
