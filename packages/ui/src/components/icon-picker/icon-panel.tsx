import { useCallback, useDeferredValue, useMemo, useState } from "react";

import type { MetadataIcon } from "@namera-ai/protocol/model";
import { Button, ColorSwatchPicker, SearchField, parseColor } from "@thenamespace/uikit";
import { HugeiconsIcon } from "@thenamespace/uikit/icons";

import { ICON_COLORS, ICON_DATA } from "./data.js";

function IconOption({
  color,
  component,
  icon,
  isSelected,
  name,
  setValue,
}: {
  color: string;
  component: string;
  icon: (typeof ICON_DATA)[number]["icon"];
  isSelected: boolean;
  name: string;
  setValue: (value: MetadataIcon) => void;
}) {
  const handlePress = useCallback(
    () => setValue({ type: "icon", value: name, color }),
    [color, name, setValue],
  );

  return (
    <Button
      isIconOnly
      aria-label={component}
      aria-pressed={isSelected}
      size="sm"
      variant={isSelected ? "secondary" : "ghost"}
      onPress={handlePress}
    >
      <HugeiconsIcon aria-hidden className="size-4" icon={icon} />
    </Button>
  );
}

export function IconPanel({
  value,
  setValue,
}: {
  value: MetadataIcon;
  setValue: (value: MetadataIcon) => void;
}) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const selectedColor = value.type === "icon" ? value.color : ICON_COLORS[5];
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

      <div className="grid max-h-72 grid-cols-8 gap-1 overflow-y-auto">
        {icons.map(({ component, icon, name }) => (
          <IconOption
            color={selectedColor}
            component={component}
            icon={icon}
            isSelected={selectedIcon === name}
            key={name}
            name={name}
            setValue={setValue}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-muted text-sm">Color</span>
        <ColorSwatchPicker value={parseColor(selectedColor)} onChange={handleColorChange}>
          {ICON_COLORS.map((color) => (
            <ColorSwatchPicker.Item color={color} key={color}>
              <ColorSwatchPicker.Swatch />
              <ColorSwatchPicker.Indicator />
            </ColorSwatchPicker.Item>
          ))}
        </ColorSwatchPicker>
      </div>
    </div>
  );
}
