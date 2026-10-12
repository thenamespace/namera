import type { ContractInterfaceId } from "@namera-ai/protocol";
import type { ListAdminInterfacesRequest } from "@namera-ai/protocol/dto";

import { interfacesAtom, interfaceAtom } from "@/atoms/interfaces";
import { toQuery } from "@/hooks/atom";

export function useInterfaces(query: ListAdminInterfacesRequest) {
  return toQuery(() => interfacesAtom(query))();
}
export function useInterface(id: ContractInterfaceId) {
  return toQuery(() => interfaceAtom(id))();
}
