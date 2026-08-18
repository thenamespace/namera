import type { WalletResponse } from "@namera-ai/protocol/dto";
import type { DataGridSelection } from "@namera-ai/ui";
import { Activity01Icon, CodeIcon, HugeiconsIcon, Shield01Icon } from "@namera-ai/ui/icons";

import type { TableFilterMenuProps } from "@/components/common/table";
import {
  WalletImplementationDisplay,
  WalletProtectionDisplay,
  WalletStatusDisplay,
} from "@/components/display";

const statusOptions = ["active", "frozen", "archived"] as const;
const implementationOptions = ["kernel", "safe"] as const;
const protectionOptions = ["software", "hsm"] as const;

type AccountFilters = {
  status: ReadonlySet<WalletResponse["status"]>;
  implementation: ReadonlySet<WalletResponse["implementation"]>;
  protectionLevel: ReadonlySet<WalletResponse["protectionLevel"]>;
};

type AccountFilterCounts = {
  status: Record<WalletResponse["status"], number>;
  implementation: Record<WalletResponse["implementation"], number>;
  protectionLevel: Record<WalletResponse["protectionLevel"], number>;
};

type AccountFilterMenuProps = {
  counts: AccountFilterCounts;
  filters: AccountFilters;
  onChange: (filters: AccountFilters) => void;
};

function createEmptyAccountFilters(): AccountFilters {
  return {
    status: new Set(),
    implementation: new Set(),
    protectionLevel: new Set(),
  };
}

function toSelection<T extends string>(keys: DataGridSelection, options: ReadonlyArray<T>): Set<T> {
  if (keys === "all") return new Set(options);
  return new Set([...keys].filter((key): key is T => typeof key === "string"));
}

const statusLabels: Record<WalletResponse["status"], string> = {
  active: "Active",
  archived: "Archived",
  frozen: "Frozen",
};

const implementationLabels: Record<WalletResponse["implementation"], string> = {
  kernel: "Kernel",
  safe: "Safe",
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
        selectedKeys: filters.status,
        options: statusOptions.map((value) => ({
          id: value,
          label: statusLabels[value],
          count: counts.status[value],
          content: <WalletStatusDisplay status={value} />,
        })),
        onSelectionChange: (keys) =>
          onChange({ ...filters, status: toSelection(keys, statusOptions) }),
      },
      {
        id: "implementation",
        label: "Implementation",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={CodeIcon} />,
        selectedKeys: filters.implementation,
        options: implementationOptions.map((value) => ({
          id: value,
          label: implementationLabels[value],
          count: counts.implementation[value],
          content: <WalletImplementationDisplay implementation={value} />,
        })),
        onSelectionChange: (keys) =>
          onChange({ ...filters, implementation: toSelection(keys, implementationOptions) }),
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
          onChange({ ...filters, protectionLevel: toSelection(keys, protectionOptions) }),
      },
    ],
    onClear: () => onChange(createEmptyAccountFilters()),
  };
}

export type { AccountFilterCounts, AccountFilterMenuProps, AccountFilters };
export { createEmptyAccountFilters };
