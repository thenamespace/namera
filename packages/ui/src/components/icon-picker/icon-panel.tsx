import { useCallback, useDeferredValue, useMemo, useState } from "react";

import type { MetadataIcon } from "@namera-ai/protocol/model";
import { Button, ColorSwatchPicker, SearchField, cn, parseColor } from "@thenamespace/uikit";
import { HugeiconsIcon } from "@thenamespace/uikit/icons";

import { ICON_COLORS, ICON_DATA } from "./data.js";

function IconOption({
  color,
  component,
  icon,
  isSelected,
  name,
  onSelect,
}: {
  color: string;
  component: string;
  icon: (typeof ICON_DATA)[number]["icon"];
  isSelected: boolean;
  name: string;
  onSelect: (value: MetadataIcon) => void;
}) {
  const handlePress = useCallback(
    () => onSelect({ type: "icon", value: name, color }),
    [color, name, onSelect],
  );

  return (
    <Button
      isIconOnly
      aria-label={component}
      aria-pressed={isSelected}
      size="md"
      variant={isSelected ? "tertiary" : "ghost"}
      onPress={handlePress}
    >
      <HugeiconsIcon
        aria-hidden
        className={cn("size-4")}
        icon={icon}
        // oxlint-disable-next-line react-perf/jsx-no-new-object-as-prop
        style={{
          color,
        }}
      />
    </Button>
  );
}

export function IconPanel({
  value,
  setValue,
  onSelect,
}: {
  value: MetadataIcon;
  setValue: (value: MetadataIcon) => void;
  onSelect: (value: MetadataIcon) => void;
}) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const selectedColor = value.type === "icon" ? value.color : ICON_COLORS[0];
  const selectedIcon = value.type === "icon" ? value.value : "home-01";
  const icons = useMemo(() => {
    if (!deferredSearch) return ICON_DATA;

    return ICON_DATA.filter(
      ({ component, name, tags }) =>
        component.toLowerCase().includes(deferredSearch) ||
        name.includes(deferredSearch) ||
        tags.some((tag) => tag.includes(deferredSearch)),
    );
  }, [deferredSearch]);

  const handleColorChange = useCallback(
    (color: ReturnType<typeof parseColor>) => {
      setValue({ type: "icon", value: selectedIcon, color: color.toString("hex") });
    },
    [selectedIcon, setValue],
  );

  return (
    <div className="flex flex-col gap-4">
      <SearchField
        aria-label="Search icons"
        value={search}
        variant="secondary"
        onChange={setSearch}
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Search icons..." />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      <div className="flex flex-col gap-2 pb-2">
        <ColorSwatchPicker value={parseColor(selectedColor)} onChange={handleColorChange}>
          {ICON_COLORS.map((color) => (
            <ColorSwatchPicker.Item color={color} key={color}>
              <ColorSwatchPicker.Swatch />
              <ColorSwatchPicker.Indicator />
            </ColorSwatchPicker.Item>
          ))}
        </ColorSwatchPicker>
      </div>

      <div className="grid max-h-80 grid-cols-10 gap-1 overflow-y-auto place-items-center">
        {icons.map(({ component, icon, name }) => (
          <IconOption
            color={selectedColor}
            component={component}
            icon={icon}
            isSelected={selectedIcon === name}
            key={name}
            name={name}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
