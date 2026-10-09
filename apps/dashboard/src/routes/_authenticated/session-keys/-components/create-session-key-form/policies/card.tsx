import type { ComponentProps, ReactNode } from "react";

import { Button, ItemCard } from "@namera-ai/ui";
import { Delete02Icon, HugeiconsIcon, PencilEdit02Icon } from "@namera-ai/ui/icons";

export function SessionPolicyCard({
  name,
  icon,
  enforcement,
  children,
  onEdit,
  onRemove,
}: {
  name: string;
  icon: ComponentProps<typeof HugeiconsIcon>["icon"];
  enforcement: "Onchain" | "Namera rules + onchain authority";
  children: ReactNode;
  onEdit?: (() => void) | undefined;
  onRemove?: (() => void) | undefined;
}) {
  return (
    <ItemCard className="border-separator min-h-20 rounded-lg border" variant="outline">
      <ItemCard.Icon className="self-center">
        <HugeiconsIcon icon={icon} />
      </ItemCard.Icon>
      <ItemCard.Content>
        <div className="flex flex-wrap items-center gap-2">
          <ItemCard.Title>{name}</ItemCard.Title>
          <span className="text-muted bg-default rounded-md px-1.5 py-0.5 text-xs">
            {enforcement}
          </span>
        </div>
        <ItemCard.Description>{children}</ItemCard.Description>
      </ItemCard.Content>
      <ItemCard.Action className="self-center">
        <div className="flex items-center gap-1">
          {onEdit ? (
            <Button
              isIconOnly
              type="button"
              size="sm"
              variant="tertiary"
              aria-label={`Edit ${name.toLowerCase()}`}
              onPress={onEdit}
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
            >
              <HugeiconsIcon icon={Delete02Icon} />
            </Button>
          ) : null}
        </div>
      </ItemCard.Action>
    </ItemCard>
  );
}
