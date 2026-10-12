import type { ContractInterfaceId } from "@namera-ai/protocol";
import type { ListAdminInterfacesRequest } from "@namera-ai/protocol/dto";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const interfacesAtom = (query: ListAdminInterfacesRequest = {}) =>
  NameraClient.query("adminCatalog", "listInterfaces", {
    query: { limit: 25, ...query },
    reactivityKeys: QueryKeys.catalog.list,
    timeToLive: "30 seconds",
  });
export const interfaceAtom = (interfaceId: ContractInterfaceId) =>
  NameraClient.query("adminCatalog", "getInterface", {
    params: { interfaceId },
    reactivityKeys: QueryKeys.catalog.list,
    timeToLive: "30 seconds",
  });
