import type { IconSvgElement } from "@thenamespace/uikit/icons";
import {
  Basketball01Icon,
  Car01Icon,
  Clock01Icon,
  CurrencyIcon,
  Flag01Icon,
  FlowerIcon,
  HandPointingRight01Icon,
  Idea01Icon,
  SmileIcon,
  SpoonAndForkIcon,
} from "@thenamespace/uikit/icons";
import type { CompactEmoji } from "emojibase";
import emojiDataSource from "emojibase-data/en/compact.json";

export const EMOJI_DATA: CompactEmoji[] = emojiDataSource.filter(
  (emoji) => typeof emoji.label === "string" && !emoji.label.startsWith("regional indicator"),
);

export const EMOJI_GROUP_IDS = {
  activities: 6,
  "animals-nature": 3,
  flags: 9,
  "food-drink": 4,
  objects: 7,
  "people-body": 1,
  "smileys-emotion": 0,
  symbols: 8,
  "travel-places": 5,
} as const;

export type EmojiCategoryId = "frequently-used" | keyof typeof EMOJI_GROUP_IDS;

export const EMOJI_CATEGORIES: ReadonlyArray<{
  icon: IconSvgElement;
  id: EmojiCategoryId;
  label: string;
}> = [
  { icon: Clock01Icon, id: "frequently-used", label: "Frequently used" },
  { icon: SmileIcon, id: "smileys-emotion", label: "Smileys and emotion" },
  { icon: HandPointingRight01Icon, id: "people-body", label: "People and body" },
  { icon: FlowerIcon, id: "animals-nature", label: "Animals and nature" },
  { icon: SpoonAndForkIcon, id: "food-drink", label: "Food and drink" },
  { icon: Basketball01Icon, id: "activities", label: "Activities" },
  { icon: Car01Icon, id: "travel-places", label: "Travel and places" },
  { icon: Idea01Icon, id: "objects", label: "Objects" },
  { icon: CurrencyIcon, id: "symbols", label: "Symbols" },
  { icon: Flag01Icon, id: "flags", label: "Flags" },
];
