import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import {
  AddressCatalogId,
  AddressCatalogEntryId,
  ContractInterfaceId,
  CatalogNotFoundError,
  CatalogImportError,
  PlatformAuthError,
} from "@namera-ai/protocol";
import {
  SearchCatalogRequest,
  SearchCatalogResponse,
  CatalogView,
  CatalogEntryView,
  ResolveCatalogRequest,
  ResolveCatalogResponse,
  ImportCatalogRequest,
  ImportCatalogQuery,
  ImportCatalogResponse,
} from "@namera-ai/protocol/dto";
import { ContractInterface } from "@namera-ai/protocol/model";

import { CommonErrors } from "#/common";
import { Authorization, AdminAuthorization } from "#/middlewares/index";

export class CatalogGroup extends HttpApiGroup.make("catalog")
  .add(
    HttpApiEndpoint.get("search", "/catalog", {
      query: SearchCatalogRequest,
      success: SearchCatalogResponse,
      error: CommonErrors,
    }),
    HttpApiEndpoint.get("get", "/catalog/:catalogId", {
      params: Schema.Struct({ catalogId: AddressCatalogId }),
      success: CatalogView,
      error: [CatalogNotFoundError, ...CommonErrors],
    }),
    HttpApiEndpoint.get("getEntry", "/catalog/entries/:entryId", {
      params: Schema.Struct({ entryId: AddressCatalogEntryId }),
      success: CatalogEntryView,
      error: [CatalogNotFoundError, ...CommonErrors],
    }),
    HttpApiEndpoint.post("resolve", "/catalog/resolve", {
      payload: ResolveCatalogRequest,
      success: ResolveCatalogResponse,
      error: CommonErrors,
    }),
    HttpApiEndpoint.get("getInterface", "/catalog/interfaces/:interfaceId", {
      params: Schema.Struct({ interfaceId: ContractInterfaceId }),
      success: ContractInterface,
      error: [CatalogNotFoundError, ...CommonErrors],
    }),
  )
  .middleware(Authorization)
  .annotate(
    OpenApi.Description,
    "Curated token and contract metadata; ABI documents are fetched separately.",
  ) {}

export class AdminCatalogGroup extends HttpApiGroup.make("adminCatalog")
  .add(
    HttpApiEndpoint.post("import", "/internal/catalog/import", {
      payload: ImportCatalogRequest,
      query: ImportCatalogQuery,
      success: ImportCatalogResponse,
      error: [CatalogImportError, PlatformAuthError, ...CommonErrors],
    }),
  )
  .middleware(AdminAuthorization)
  .annotate(HttpApi.PayloadParseOptions, { onExcessProperty: "error" })
  .annotate(OpenApi.Exclude, true) {}
