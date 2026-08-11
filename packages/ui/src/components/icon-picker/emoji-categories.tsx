import { useCallback } from "react";

import { Button, EmojiPicker, Tooltip } from "@thenamespace/uikit";
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
        className="size-8 shrink-0"
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
    <EmojiPicker.Footer className="bg-overlay p-1 w-full py-2 ">
      <div className="grid grid-cols-10 gap-1 place-items-center p-0 w-full border rounded-lg bg-foreground/10">
        {EMOJI_CATEGORIES.map((category) => (
          <EmojiCategory category={category} key={category.id} onSelect={onSelect} />
        ))}
      </div>
    </EmojiPicker.Footer>
  );
}
