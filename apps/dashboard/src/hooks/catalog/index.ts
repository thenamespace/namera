import { catalogPickerSearchAtom } from "@/atoms/catalog";
import { toQuery } from "@/hooks/atom";

export const useCatalogPickerSearch = toQuery(catalogPickerSearchAtom);
