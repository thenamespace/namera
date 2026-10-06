import type { WalletResponse } from "@namera-ai/protocol/dto";
import { Activity01Icon, HugeiconsIcon, Shield01Icon } from "@namera-ai/ui/icons";

import { toTableSelection, type TableFilterMenuProps } from "@/components/common/table";
import { WalletOwnerDisplay, WalletStatusDisplay } from "@/components/display";

const statusOptions = ["active", "frozen", "archived"] as const;
const ownershipOptions = ["local", "namera-managed"] as const;
const defaultStatuses: ReadonlySet<WalletResponse["status"]> = new Set(["active"]);

type AccountFilters = {
  status: ReadonlySet<WalletResponse["status"]>;
  ownership: ReadonlySet<WalletResponse["owner"]["custody"]>;
};

type AccountFilterCounts = {
  status: Record<WalletResponse["status"], number>;
  ownership: Record<WalletResponse["owner"]["custody"], number>;
};

type AccountFilterMenuProps = {
  counts: AccountFilterCounts;
  filters: AccountFilters;
  onChange: (filters: AccountFilters) => void;
};

function createDefaultAccountFilters(): AccountFilters {
  return {
    status: new Set(defaultStatuses),
    ownership: new Set(),
  };
}

const statusLabels: Record<WalletResponse["status"], string> = {
  active: "Active",
  archived: "Archived",
  frozen: "Frozen",
};

const ownershipLabels: Record<WalletResponse["owner"]["custody"], string> = {
  local: "User owned",
  "namera-managed": "Namera managed",
};

export function accountFilterMenu({
  counts,
  filters,
  onChange,
}: AccountFilterMenuProps): TableFilterMenuProps {
  return {
    ariaLabel: "Apply account filters",
    facets: [
      {
        id: "status",
        label: "Status",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Activity01Icon} />,
        defaultSelectedKeys: defaultStatuses,
        selectedKeys: filters.status,
        options: statusOptions.map((value) => ({
          id: value,
          label: statusLabels[value],
          count: counts.status[value],
          content: <WalletStatusDisplay status={value} />,
        })),
        onSelectionChange: (keys) =>
          onChange({ ...filters, status: toTableSelection(keys, statusOptions) }),
      },
      {
        id: "ownership",
        label: "Ownership",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Shield01Icon} />,
        selectedKeys: filters.ownership,
        options: ownershipOptions.map((value) => ({
          id: value,
          label: ownershipLabels[value],
          count: counts.ownership[value],
          content: <WalletOwnerDisplay custody={value} />,
        })),
        onSelectionChange: (keys) =>
          onChange({ ...filters, ownership: toTableSelection(keys, ownershipOptions) }),
      },
    ],
    onClear: () => onChange(createDefaultAccountFilters()),
  };
}

export type { AccountFilterCounts, AccountFilterMenuProps, AccountFilters };
export { createDefaultAccountFilters };
