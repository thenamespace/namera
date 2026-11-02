import type { CatalogView } from "@namera-ai/protocol/dto";
import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { Avatar } from "@namera-ai/ui";
import {
  CheckmarkCircle02Icon,
  Clock01Icon,
  CancelCircleIcon,
  HugeiconsIcon,
} from "@namera-ai/ui/icons";

export type CatalogRecord = typeof CatalogView.Type;

export const chainNames: Record<SupportedEvmChainId, string> = {
  "eip155:1": "Ethereum",
  "eip155:10": "OP Mainnet",
  "eip155:5042": "Arc",
  "eip155:5042002": "Arc Testnet",
  "eip155:8453": "Base",
  "eip155:42161": "Arbitrum One",
  "eip155:11155111": "Ethereum Sepolia",
  "eip155:11155420": "OP Sepolia",
  "eip155:84532": "Base Sepolia",
  "eip155:421614": "Arbitrum Sepolia",
};

export function CatalogIdentity({ record }: { record: CatalogRecord }) {
  const { display } = record.data;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar size="sm">
        <Avatar.Image src={`https://cdn.namera.ai/${display.logo}`} alt="" />
        <Avatar.Fallback>{display.name.slice(0, 2).toUpperCase()}</Avatar.Fallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-foreground truncate text-sm font-medium">{display.name}</p>
        <p className="text-muted truncate text-xs">
          {record.data.type === "erc20"
            ? record.data.details.symbol
            : (record.data.details.protocol ?? record.slug)}
        </p>
      </div>
    </div>
  );
}

const statuses = {
  published: { label: "Published", icon: CheckmarkCircle02Icon, color: "text-success" },
  draft: { label: "Draft", icon: Clock01Icon, color: "text-warning" },
  archived: { label: "Archived", icon: CancelCircleIcon, color: "text-muted" },
} as const;

export function CatalogStatus({ status }: { status: CatalogRecord["status"] }) {
  const presentation = statuses[status];
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <HugeiconsIcon icon={presentation.icon} className={`size-4 shrink-0 ${presentation.color}`} />
      {presentation.label}
    </span>
  );
}
