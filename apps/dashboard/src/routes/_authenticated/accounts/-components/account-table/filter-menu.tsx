import type { WalletResponse } from "@namera-ai/protocol/dto";
import { Activity01Icon, HugeiconsIcon, Shield01Icon } from "@namera-ai/ui/icons";

import { toTableSelection, type TableFilterMenuProps } from "@/components/common/table";
import { WalletProtectionDisplay, WalletStatusDisplay } from "@/components/display";

const statusOptions = ["active", "frozen", "archived"] as const;
const protectionOptions = ["software", "hsm"] as const;
const defaultStatuses: ReadonlySet<WalletResponse["status"]> = new Set(["active"]);

type AccountFilters = {
  status: ReadonlySet<WalletResponse["status"]>;
  protectionLevel: ReadonlySet<WalletResponse["protectionLevel"]>;
};

type AccountFilterCounts = {
  status: Record<WalletResponse["status"], number>;
  protectionLevel: Record<WalletResponse["protectionLevel"], number>;
};

type AccountFilterMenuProps = {
  counts: AccountFilterCounts;
  filters: AccountFilters;
  onChange: (filters: AccountFilters) => void;
};

function createDefaultAccountFilters(): AccountFilters {
  return {
    status: new Set(defaultStatuses),
    protectionLevel: new Set(),
  };
}

const statusLabels: Record<WalletResponse["status"], string> = {
  active: "Active",
  archived: "Archived",
  frozen: "Frozen",
};

const protectionLabels: Record<WalletResponse["protectionLevel"], string> = {
  hsm: "HSM",
  software: "Software",
};

export function AccountFilterMenu({
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
        id: "protection",
        label: "Protection",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Shield01Icon} />,
        selectedKeys: filters.protectionLevel,
        options: protectionOptions.map((value) => ({
          id: value,
          label: protectionLabels[value],
          count: counts.protectionLevel[value],
          content: <WalletProtectionDisplay protectionLevel={value} />,
        })),
        onSelectionChange: (keys) =>
          onChange({ ...filters, protectionLevel: toTableSelection(keys, protectionOptions) }),
      },
    ],
    onClear: () => onChange(createDefaultAccountFilters()),
  };
}

export type { AccountFilterCounts, AccountFilterMenuProps, AccountFilters };
export { createDefaultAccountFilters };
