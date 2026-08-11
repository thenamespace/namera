import type { Key } from "react";
import { useCallback } from "react";

import type { MetadataIcon } from "@namera-ai/protocol/model";
import { EmojiPicker, EmptyState, SearchField } from "@thenamespace/uikit";
import { SmileIcon } from "@thenamespace/uikit/icons";
import { HugeiconsIcon } from "@thenamespace/uikit/icons";
import emojiDataSource from "emojibase-data/en/compact.json";

const emojiData = emojiDataSource.filter(
  (emoji) => typeof emoji.label === "string" && !emoji.label.startsWith("regional indicator"),
);

function renderEmptyState() {
  return (
    <EmptyState className="flex min-h-24 flex-col items-center justify-center gap-2">
      <HugeiconsIcon aria-hidden className="text-muted size-5" icon={SmileIcon} />
      No emoji found.
    </EmptyState>
  );
}

function renderEmoji(emoji: (typeof emojiData)[number]) {
  return (
    <EmojiPicker.Item
      id={emoji.unicode}
      textValue={`${emoji.label ?? ""} ${emoji.tags?.join(" ") ?? ""}`}
    >
      {emoji.unicode}
    </EmojiPicker.Item>
  );
}

export function EmojiPanel({
  value,
  setValue,
}: {
  value: MetadataIcon;
  setValue: (value: MetadataIcon) => void;
}) {
  const handleSelectionChange = useCallback(
    (key: Key | null) => {
      if (key !== null) setValue({ type: "emoji", value: String(key) });
    },
    [setValue],
  );

  return (
    <EmojiPicker
      aria-label="Choose emoji"
      selectedKey={value.type === "emoji" ? value.value : null}
      size="md"
      onSelectionChange={handleSelectionChange}
    >
      <div className="emoji-picker__popover emoji-picker__popover--md relative w-full">
        <EmojiPicker.Content>
          <SearchField aria-label="Search emoji" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search emoji..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <EmojiPicker.Grid items={emojiData} renderEmptyState={renderEmptyState}>
            {renderEmoji}
          </EmojiPicker.Grid>
        </EmojiPicker.Content>
      </div>
    </EmojiPicker>
  );
}
