import type { MetadataIcon } from "@namera-ai/schema";

import { useMemo, useState } from "react";
import { useRef } from "react";

import { useVirtualizer } from "@tanstack/react-virtual";

import emojiData from "emojibase-data/en/data.json";

import { Button } from "@namera-ai/ui/components/ui/button";
import { Input } from "@namera-ai/ui/components/ui/input";

type PickerEmoji = {
  emoji: string;
  hexcode: string;
  label: string;
  group: number;
  search: string;
};

const EMOJIS: PickerEmoji[] = emojiData.map((e) => ({
  emoji: e.emoji,
  hexcode: e.hexcode,
  label: e.label,
  group: e.group ?? 0,
  search: (
    e.label +
    " " +
    (e.tags?.join(" ") ?? "") +
    " " +
    (e.shortcodes?.join(" ") ?? "")
  ).toLowerCase(),
}));

const COLS = 12;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 32;

export type GroupKey =
  | "activities"
  | "animals-nature"
  | "component"
  | "flags"
  | "food-drink"
  | "objects"
  | "people-body"
  | "smileys-emotion"
  | "symbols"
  | "travel-places";

const GROUP_META = [
  { id: 0, label: "Smileys", icon: "😀" },
  { id: 1, label: "People", icon: "🧑" },
  { id: 2, label: "Animals", icon: "🐶" },
  { id: 3, label: "Food", icon: "🍔" },
  { id: 4, label: "Travel", icon: "🚗" },
  { id: 5, label: "Activities", icon: "⚽" },
  { id: 6, label: "Objects", icon: "💡" },
  { id: 7, label: "Symbols", icon: "❤️" },
  { id: 8, label: "Flags", icon: "🏳️" },
];

type Row = { type: "header"; label: string } | { type: "emojis"; items: any[] };

export const useEmojiPicker = () => {
  const [search, setSearch] = useState("");

  const emojis = useMemo(() => {
    if (search.trim() !== "") {
      const q = search.toLowerCase();

      return EMOJIS.filter((e) => e.search.includes(q)).slice(0, 300);
    }
    return EMOJIS;
  }, [search]);

  return {
    search,
    setSearch,
    emojis,
  };
};

export const EmojiPickerComponent = ({
  onChange,
}: {
  onChange: (icon: MetadataIcon) => void;
}) => {
  const { search, setSearch, emojis } = useEmojiPicker();
  const parentRef = useRef<HTMLDivElement>(null);

  const rows: Row[] = useMemo(() => {
    if (search) {
      const resultRows: Row[] = [];

      for (let i = 0; i < emojis.length; i += COLS) {
        resultRows.push({
          type: "emojis",
          items: emojis.slice(i, i + COLS),
        });
      }

      return resultRows;
    }

    const grouped: Row[] = [];

    for (const group of GROUP_META) {
      const groupEmojis = emojis.filter((e) => e.group === group.id);

      if (groupEmojis.length === 0) continue;

      // header
      grouped.push({
        type: "header",
        label: group.label,
      });

      for (let i = 0; i < groupEmojis.length; i += COLS) {
        grouped.push({
          type: "emojis",
          items: groupEmojis.slice(i, i + COLS),
        });
      }
    }

    return grouped;
  }, [emojis, search]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) =>
      rows[index]!.type === "header" ? HEADER_HEIGHT : ROW_HEIGHT,
    overscan: 5,
  });

  return (
    <div className="relative">
      <Input
        placeholder="Search..."
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div
        ref={parentRef}
        className="no-scrollbar mx-auto mt-2 h-100 overflow-y-auto"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]!;

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.type === "header" && (
                  <div className="text-muted-foreground px-2 text-xs font-medium">
                    {row.label}
                  </div>
                )}
                {row.type === "emojis" && (
                  <div className="grid grid-cols-12 gap-2 px-2">
                    {row.items.map(({ emoji, hexcode }) => (
                      <Button
                        key={hexcode}
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          onChange({ type: "emoji", value: emoji })
                        }
                      >
                        <span className="text-lg">{emoji}</span>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {emojis.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p>No emojis found</p>
        </div>
      )}
    </div>
  );
};
