import type { ContractInterfaceId } from "@namera-ai/protocol";
import type { ListAdminInterfacesRequest } from "@namera-ai/protocol/dto";

import { interfacesAtom, interfaceAtom } from "@/atoms/interfaces";
import { toQuery } from "@/hooks/atom";

export const useInterfaces = toQuery((query: ListAdminInterfacesRequest) => interfacesAtom(query));
export const useInterface = toQuery((id: ContractInterfaceId) => interfaceAtom(id));
