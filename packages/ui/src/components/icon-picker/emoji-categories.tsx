import { useCallback } from "react";

import { Button, EmojiPicker, ScrollShadow, Tooltip } from "@thenamespace/uikit";
import { HugeiconsIcon } from "@thenamespace/uikit/icons";

import { EMOJI_CATEGORIES, type EmojiCategoryId } from "./emoji-data.js";

function EmojiCategory({
  category,
  onSelect,
}: {
  category: (typeof EMOJI_CATEGORIES)[number];
  onSelect: (id: EmojiCategoryId) => void;
}) {
  const handlePress = useCallback(() => onSelect(category.id), [category.id, onSelect]);

  return (
    <Tooltip delay={0}>
      <Button
        isIconOnly
        aria-label={category.label}
        className="size-7 shrink-0"
        size="sm"
        variant="ghost"
        onPress={handlePress}
      >
        <HugeiconsIcon aria-hidden className="size-4" icon={category.icon} />
      </Button>
      <Tooltip.Content placement="top">
        <p>{category.label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

export function EmojiCategories({ onSelect }: { onSelect: (id: EmojiCategoryId) => void }) {
  return (
    <EmojiPicker.Footer>
      <ScrollShadow hideScrollBar orientation="horizontal">
        <div className="flex items-center justify-between gap-1 px-1 py-0.5">
          {EMOJI_CATEGORIES.map((category) => (
            <EmojiCategory category={category} key={category.id} onSelect={onSelect} />
          ))}
        </div>
      </ScrollShadow>
    </EmojiPicker.Footer>
  );
}
