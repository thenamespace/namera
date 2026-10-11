// oxlint-disable react-perf/jsx-no-new-function-as-prop
import type { ReactNode } from "react";

import { Button } from "@namera-ai/ui";
import { Copy01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import { copyCatalogValue } from "./catalog-actions";

export function CatalogProperty({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-9 grid-cols-[minmax(7rem,0.42fr)_minmax(0,1fr)] items-start gap-5 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <dt className="text-muted text-sm">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

export function CatalogCopyValue({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <code className="break-all text-xs">{value}</code>
      <Button
        size="sm"
        className="size-7 shrink-0"
        variant="ghost"
        isIconOnly
        aria-label={`Copy ${label}`}
        onPress={() => {
          void copyCatalogValue(value, label);
        }}
      >
        <HugeiconsIcon icon={Copy01Icon} />
      </Button>
    </div>
  );
}
