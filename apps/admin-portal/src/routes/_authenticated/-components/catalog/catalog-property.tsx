// oxlint-disable react-perf/jsx-no-new-function-as-prop
import type { ReactNode } from "react";

import { CopyIconButton, toast } from "@namera-ai/ui";
import { LinkSquare02Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

export function CatalogProperty({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-9 grid-cols-[minmax(7rem,0.42fr)_minmax(0,1fr)] items-start gap-5 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <dt className="text-muted text-sm">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

export function CatalogCopyValue({
  value,
  label,
  explorerUrl,
}: {
  value: string;
  label: string;
  explorerUrl?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <code className="break-all text-xs">{value}</code>
      <CopyIconButton
        className="size-7 shrink-0"
        label={label}
        value={value}
        onCopySuccess={() => toast.success(`${label} copied`)}
        onCopyError={() =>
          toast.danger(`Couldn’t copy ${label.toLowerCase()}`, {
            description: "Select and copy the value manually.",
          })
        }
      />
      {explorerUrl ? (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`View ${label} on explorer`}
          title="View on explorer"
          className="text-muted hover:text-foreground focus-visible:outline-accent inline-flex size-7 shrink-0 items-center justify-center rounded-md focus-visible:outline-2"
        >
          <HugeiconsIcon icon={LinkSquare02Icon} className="size-4" aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );
}
