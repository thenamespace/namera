import { createFileRoute, Link } from "@tanstack/react-router";

import { Schema } from "effect";

import { AddressCatalogId } from "@namera-ai/protocol";
import { Button } from "@namera-ai/ui";

import { currentAdminAtom } from "@/atoms/auth";
import { catalogDetailAtom } from "@/atoms/catalog";
import { prefetchQuery } from "@/atoms/prefetch";
import { AdminPage } from "@/components/page";
import { hasPermissions, PermissionGuard, readCatalogPermission } from "@/components/permission";
import { useCatalogDetail } from "@/hooks/catalog";

import { CatalogDetails } from "./-components/catalog/catalog-details";

export const Route = createFileRoute("/_authenticated/catalog_/$catalogId")({
  params: {
    parse: (params) => ({
      catalogId: Schema.decodeUnknownSync(AddressCatalogId)(params.catalogId),
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
        catalogDetailAtom(params.catalogId),
        abortController.signal,
      );
    }
  },
  errorComponent: () => (
    <AdminPage title="Catalog">
      <p role="alert">Couldn’t load this catalog record. It may no longer exist.</p>
      <Link to="/catalog" className="mt-3 inline-block text-sm underline">
        Back to catalog
      </Link>
    </AdminPage>
  ),
  component: CatalogPage,
});

function CatalogPage() {
  const { catalogId } = Route.useParams();
  const catalog = useCatalogDetail(catalogId);
  return (
    <AdminPage title={catalog.data?.data.display.name ?? "Catalog"}>
      <PermissionGuard required={readCatalogPermission}>
        {catalog.error ? (
          <div role="alert">
            <p>Couldn’t load this catalog record.</p>
            <Button variant="tertiary" onPress={catalog.refetch}>
              Try again
            </Button>
          </div>
        ) : catalog.data ? (
          <CatalogDetails record={catalog.data} />
        ) : (
          <output>Loading catalog record…</output>
        )}
      </PermissionGuard>
    </AdminPage>
  );
}
