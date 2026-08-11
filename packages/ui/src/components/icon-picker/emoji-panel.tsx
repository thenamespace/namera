import type { Key } from "react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import type { MetadataIcon } from "@namera-ai/protocol/model";
import { EmojiPicker, EmptyState, SearchField } from "@thenamespace/uikit";
import { HugeiconsIcon, SmileIcon } from "@thenamespace/uikit/icons";

import { EmojiCategories } from "./emoji-categories.js";
import { EMOJI_DATA, EMOJI_GROUP_IDS, type EmojiCategoryId } from "./emoji-data.js";

function renderEmptyState() {
  return (
    <EmptyState className="flex min-h-24 flex-col items-center justify-center gap-2">
      <HugeiconsIcon aria-hidden className="text-muted size-5" icon={SmileIcon} />
      No emoji found.
    </EmptyState>
  );
}

function renderEmoji(emoji: (typeof EMOJI_DATA)[number]) {
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
  onSelect,
}: {
  value: MetadataIcon;
  onSelect: (value: MetadataIcon) => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryRequest, setCategoryRequest] = useState<{ id: EmojiCategoryId }>();
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase());
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const items = useMemo(() => {
    if (!deferredSearch) return EMOJI_DATA;

    return EMOJI_DATA.filter((emoji) => {
      const text = `${emoji.label ?? ""} ${Array.isArray(emoji.tags) ? emoji.tags.join(" ") : ""}`;
      return text.toLocaleLowerCase().includes(deferredSearch);
    });
  }, [deferredSearch]);
  const groupStartIndices = useMemo(() => {
    const indices: Partial<Record<keyof typeof EMOJI_GROUP_IDS, number>> = {};

    for (const [id, group] of Object.entries(EMOJI_GROUP_IDS) as Array<
      [keyof typeof EMOJI_GROUP_IDS, number]
    >) {
      const index = EMOJI_DATA.findIndex((emoji) => emoji.group === group);
      if (index !== -1) indices[id] = index;
    }

    return indices;
  }, []);
  const handleSelectionChange = useCallback(
    (key: Key | null) => {
      if (key !== null) onSelect({ type: "emoji", value: String(key) });
    },
    [onSelect],
  );
  const handleCategorySelect = useCallback((id: EmojiCategoryId) => {
    setSearch("");
    setCategoryRequest({ id });
  }, []);

  useEffect(() => {
    if (!categoryRequest) return;

    const grid = gridContainerRef.current?.querySelector<HTMLElement>(
      '[data-slot="emoji-picker-grid"]',
    );
    if (!grid) return;

    if (categoryRequest.id === "frequently-used") {
      grid.scrollTo({ behavior: "smooth", top: 0 });
      return;
    }

    const index = groupStartIndices[categoryRequest.id];
    if (index === undefined) return;

    const itemSize = 38;
    const columns = Math.max(1, Math.floor(grid.clientWidth / itemSize));
    grid.scrollTo({ behavior: "smooth", top: Math.floor(index / columns) * itemSize });
  }, [categoryRequest, groupStartIndices]);

  return (
    <EmojiPicker
      aria-label="Choose emoji"
      selectedKey={value.type === "emoji" ? value.value : null}
      size="md"
      onSelectionChange={handleSelectionChange}
    >
      <div
        className="emoji-picker__popover emoji-picker__popover--lg relative w-full overflow-visible rounded-none shadow-none h-118"
        ref={gridContainerRef}
      >
        <EmojiPicker.Content className="overflow-visible p-0">
          <SearchField
            aria-label="Search emoji"
            value={search}
            variant="secondary"
            onChange={setSearch}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search emoji..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <EmojiPicker.Grid className="h-80" items={items} renderEmptyState={renderEmptyState}>
            {renderEmoji}
          </EmojiPicker.Grid>
          <EmojiCategories onSelect={handleCategorySelect} />
        </EmojiPicker.Content>
      </div>
    </EmojiPicker>
  );
}
