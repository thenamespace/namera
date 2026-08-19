import type { DataGridSelection } from "@namera-ai/ui";

export const countTableValues = <Item, Key>(
  items: ReadonlyArray<Item>,
  getKey: (item: Item) => Key,
): ReadonlyMap<Key, number> => {
  const counts = new Map<Key, number>();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

export const uniqueTableValues = <Item, Key>(
  items: ReadonlyArray<Item>,
  getKey: (item: Item) => Key,
): ReadonlyMap<Key, Item> => {
  const values = new Map<Key, Item>();
  for (const item of items) {
    const key = getKey(item);
    if (!values.has(key)) values.set(key, item);
  }
  return values;
};

export function toTableSelection<Key extends string>(
  selection: DataGridSelection,
  availableKeys: ReadonlyArray<Key>,
): Set<Key> {
  if (selection === "all") return new Set(availableKeys);
  const available = new Set(availableKeys);
  return new Set(
    [...selection].filter(
      (key): key is Key => typeof key === "string" && available.has(key as Key),
    ),
  );
}
