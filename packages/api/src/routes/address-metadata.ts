import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

import { AddressMetadataUnavailableError } from "@namera-ai/protocol";
import {
  AddressMetadataResponse,
  GetAddressMetadataRequest,
  ResolveAddressMetadataRequest,
  ResolveAddressMetadataResponse,
  SearchAddressMetadataRequest,
  SearchAddressMetadataResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class AddressMetadataGroup extends HttpApiGroup.make("addressMetadata")
  .add(
    HttpApiEndpoint.post("resolve", "/resolve", {
      payload: ResolveAddressMetadataRequest,
      success: ResolveAddressMetadataResponse,
      error: [AddressMetadataUnavailableError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Resolve normalized metadata for a batch of addresses"),
    HttpApiEndpoint.get("search", "/search", {
      query: SearchAddressMetadataRequest,
      success: SearchAddressMetadataResponse,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "Search enriched addresses on a chain"),
    HttpApiEndpoint.get("get", "/:namespace/:chainId/:address", {
      params: GetAddressMetadataRequest,
      success: AddressMetadataResponse,
      error: [AddressMetadataUnavailableError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Get normalized metadata for an address"),
  )
  .annotate(OpenApi.Description, "Namespace-neutral address identity and trust metadata")
  .middleware(Authorization)
  .prefix("/address-metadata") {}
