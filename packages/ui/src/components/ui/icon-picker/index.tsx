import type { MetadataIcon } from "@namera-ai/schema";

import React, { useMemo, useState } from "react";

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
import { cn } from "@namera-ai/ui/lib/utils";

import { ICON_DATA, type IconData } from "./data";
import { EmojiPickerComponent } from "./emoji";
import { ImagePickerComponent } from "./image";
import { IconRenderer, MetadataIconRenderer } from "./renderer";

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

const IconPickerComponent = ({
  onChange,
}: {
  onChange: (icon: MetadataIcon) => void;
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
                  onClick={() => onChange({ type: "icon", value: name })}
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
  onChange: (icon: MetadataIcon) => void;
  value: MetadataIcon;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(e) => setOpen(e)}>
      <DialogTrigger
        render={
          <Button
            variant="secondary"
            className={cn("h-9 max-w-9", value.type === "image" && "p-0!")}
          />
        }
      >
        <MetadataIconRenderer
          value={value}
          className="size-9 rounded-lg"
          iconCls="text-muted-foreground size-4.5!"
          emojiCls="min-w-9 h-9 text-lg"
        />
      </DialogTrigger>
      <DialogContent className="min-w-md px-1 py-1">
        <Tabs defaultValue="icon">
          <TabsList variant="line">
            <TabsTrigger value="icon">Icons</TabsTrigger>
            <TabsTrigger value="emoji">Emojis</TabsTrigger>
            <TabsTrigger value="image">Image</TabsTrigger>
          </TabsList>
          <TabsContent value="icon" className="p-2">
            <IconPickerComponent
              onChange={(icon) => {
                onChange(icon);
                setOpen(false);
              }}
            />
          </TabsContent>
          <TabsContent value="emoji" className="p-2">
            <EmojiPickerComponent
              onChange={(icon) => {
                onChange(icon);
                setOpen(false);
              }}
            />
          </TabsContent>
          <TabsContent value="image" className="p-2">
            <ImagePickerComponent
              value={value}
              onDone={(imgSrc: string) => {
                onChange({ type: "image", value: imgSrc });
                setOpen(false);
              }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export { IconPicker, useIconPicker, MetadataIconRenderer };
