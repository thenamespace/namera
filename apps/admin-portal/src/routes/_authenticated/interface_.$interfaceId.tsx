import { createFileRoute, Link } from "@tanstack/react-router";

import { Schema } from "effect";

import { ContractInterfaceId } from "@namera-ai/protocol";
import { Button } from "@namera-ai/ui";

import { currentAdminAtom } from "@/atoms/auth";
import { interfaceAtom } from "@/atoms/interfaces";
import { prefetchQuery } from "@/atoms/prefetch";
import { AdminPage } from "@/components/page";
import { hasPermissions, PermissionGuard, readCatalogPermission } from "@/components/permission";
import { useInterface } from "@/hooks/interfaces";

import { InterfaceDetails } from "./-components/interfaces/interface-details";

export const Route = createFileRoute("/_authenticated/interface_/$interfaceId")({
  params: {
    parse: (params) => ({
      interfaceId: Schema.decodeUnknownSync(ContractInterfaceId)(params.interfaceId),
    }),
  },
  loader: async ({ context, params, abortController }) => {
    const access = await prefetchQuery(
      context.atomRegistry,
      currentAdminAtom,
      abortController.signal,
    );
    if (
      access.status === "authorized" &&
      hasPermissions(access.admin.permissions, readCatalogPermission)
    ) {
      await prefetchQuery(
        context.atomRegistry,
        interfaceAtom(params.interfaceId),
        abortController.signal,
      );
    }
  },
  errorComponent: () => (
    <AdminPage title="Interface">
      <p role="alert">Couldn’t load this interface. It may no longer exist.</p>
      <Link to="/interface" className="mt-3 inline-block text-sm underline">
        Back to interfaces
      </Link>
    </AdminPage>
  ),
  component: InterfacePage,
});

function InterfacePage() {
  const { interfaceId } = Route.useParams();
  const artifact = useInterface(interfaceId);
  return (
    <AdminPage title="Interface">
      <PermissionGuard required={readCatalogPermission}>
        {artifact.error ? (
          <div role="alert">
            <p>Couldn’t load this interface.</p>
            <Button variant="tertiary" onPress={artifact.refetch}>
              Try again
            </Button>
          </div>
        ) : artifact.data ? (
          <InterfaceDetails artifact={artifact.data} />
        ) : (
          <output>Loading interface…</output>
        )}
      </PermissionGuard>
    </AdminPage>
  );
}
