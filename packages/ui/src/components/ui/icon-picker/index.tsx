import React, { useMemo, useState } from "react";

import { PencilSimpleIcon } from "@phosphor-icons/react";

import { Button } from "@namera-ai/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@namera-ai/ui/components/ui/dialog";
import { Input } from "@namera-ai/ui/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@namera-ai/ui/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@namera-ai/ui/components/ui/tooltip";

import { iconMap, ICON_DATA, type IconData } from "./data";

const useIconPicker = (): {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  icons: IconData[];
} => {
  const [search, setSearch] = useState("");

  const filteredIcons = useMemo(() => {
    return ICON_DATA.filter((icon) => {
      if (search === "") {
        return true;
      } else if (icon.name.toLowerCase().includes(search.toLowerCase())) {
        return true;
      } else {
        return false;
      }
    });
  }, [search]);

  return { search, setSearch, icons: filteredIcons };
};

const IconRenderer = ({
  icon,
  ...rest
}: {
  icon: string;
} & React.ComponentPropsWithoutRef<"svg">) => {
  const IconComponent = iconMap[icon]?.Icon;

  if (!IconComponent) {
    return null;
  }

  return <IconComponent data-slot="icon" {...rest} />;
};

const IconPickerComponent = ({
  onChange,
}: {
  onChange: (icon: string) => void;
}) => {
  const { search, setSearch, icons } = useIconPicker();

  return (
    <div className="relative">
      <Input
        placeholder="Search..."
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="no-scrollbar mx-auto mt-2 grid h-full max-h-100 grid-cols-12 gap-2 overflow-y-scroll py-4 pb-12">
        {icons.map(({ name, component }) => (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  key={name}
                  type="button"
                  role="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onChange(name)}
                />
              }
            >
              <IconRenderer icon={name} className="size-4! shrink-0" />
              <span className="sr-only">{name}</span>
            </TooltipTrigger>
            <TooltipContent>{component}</TooltipContent>
          </Tooltip>
        ))}
        {icons.length === 0 && (
          <div className="col-span-full flex grow flex-col items-center justify-center gap-2 text-center">
            <p>No icons found...</p>
            <Button onClick={() => setSearch("")} variant="ghost">
              Clear search
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const IconPicker = ({
  value,
  onChange,
}: {
  onChange: (icon: string) => void;
  value: string;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(e) => setOpen(e)}>
      <DialogTrigger
        render={<Button variant="secondary" className="h-9 max-w-9" />}
      >
        {value ? (
          <IconRenderer
            className="text-muted-foreground size-4.5"
            icon={value}
          />
        ) : (
          <PencilSimpleIcon className="text-muted-foreground size-4.5" />
        )}
      </DialogTrigger>
      <DialogContent className="min-w-md px-1 py-2">
        <Tabs defaultValue="icon">
          <TabsList variant="line">
            <TabsTrigger value="icon">Icons</TabsTrigger>
          </TabsList>
          <TabsContent value="icon" className="p-2">
            <IconPickerComponent
              onChange={(icon) => {
                onChange(icon);
                setOpen(false);
              }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export { IconPicker, useIconPicker };
