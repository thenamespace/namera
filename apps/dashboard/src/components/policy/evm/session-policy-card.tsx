import type { ReactNode } from "react";

import { Button, ItemCard } from "@namera-ai/ui";
import { Delete02Icon, HugeiconsIcon, PencilEdit02Icon } from "@namera-ai/ui/icons";

export function SessionPolicyCard({
  name,
  logo,
  children,
  editor,
  onEdit,
  onRemove,
  selected = false,
  disabled = false,
}: {
  name: string;
  logo: ReactNode;
  children: ReactNode;
  editor?: ReactNode;
  onEdit?: (() => void) | undefined;
  onRemove?: (() => void) | undefined;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <ItemCard
      className={`flex-wrap items-start gap-3 rounded-xl border p-4 ${selected ? "border-accent" : "border-separator"}`}
      variant="outline"
    >
      <ItemCard.Icon className="mt-0 size-10 shrink-0 self-start rounded-lg [&_svg]:size-5">
        {logo}
      </ItemCard.Icon>
      <ItemCard.Content className="min-w-0 gap-1 self-start">
        <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1">
          <ItemCard.Title>{name}</ItemCard.Title>
        </div>
        <div className="text-muted text-xs leading-5 [overflow-wrap:anywhere]">{children}</div>
      </ItemCard.Content>
      {onEdit || onRemove ? (
        <ItemCard.Action className="shrink-0 self-start">
          <div className="flex items-center gap-1">
            {onEdit ? (
              <Button
                isIconOnly
                type="button"
                size="sm"
                variant="tertiary"
                aria-label={`Edit ${name.toLowerCase()}`}
                onPress={onEdit}
                isDisabled={disabled}
                aria-pressed={selected}
              >
                <HugeiconsIcon icon={PencilEdit02Icon} />
              </Button>
            ) : null}
            {onRemove ? (
              <Button
                isIconOnly
                type="button"
                size="sm"
                variant="tertiary"
                aria-label={`Remove ${name.toLowerCase()}`}
                onPress={onRemove}
                isDisabled={disabled}
              >
                <HugeiconsIcon icon={Delete02Icon} />
              </Button>
            ) : null}
          </div>
        </ItemCard.Action>
      ) : null}
      {editor ? (
        <div className="min-w-0 basis-full border-t border-separator pt-4">{editor}</div>
      ) : null}
    </ItemCard>
  );
}
