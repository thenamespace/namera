import { catalogPickerSearchAtom } from "@/atoms/catalog";
import { catalogAddressAtom } from "@/atoms/catalog/resolve";
import { toQuery } from "@/hooks/atom";

export const useCatalogPickerSearch = toQuery(catalogPickerSearchAtom);
export const useCatalogAddress = toQuery(catalogAddressAtom);
