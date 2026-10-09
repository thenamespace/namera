import type { ReactNode } from "react";

import { Button, Checkbox, Dropdown, Header, Label, type DataGridSelection } from "@namera-ai/ui";
import { FilterHorizontalIcon, FilterRemoveIcon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

type TableFilterOption = {
  group?: string;
  count?: number;
  id: string;
  label: string;
  content?: ReactNode;
};

type TableFilterFacet = {
  groups?: ReadonlyArray<string>;
  emptyLabel?: string;
  defaultSelectedKeys?: ReadonlySet<string>;
  disallowEmptySelection?: boolean;
  icon: ReactNode;
  id: string;
  label: string;
  options: ReadonlyArray<TableFilterOption>;
  selectionMode?: "multiple" | "single";
  selectedKeys: ReadonlySet<string>;
  onSelectionChange: (selection: DataGridSelection) => void;
};

const emptySelection = new Set<string>();

function selectionsMatch(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && [...left].every((key) => right.has(key));
}

type TableFilterMenuProps = {
  ariaLabel: string;
  facets: ReadonlyArray<TableFilterFacet>;
  onClear: () => void;
};

function selectionSummary(facet: TableFilterFacet): string {
  if (facet.selectedKeys.size === 0) return "Any";
  if (facet.selectedKeys.size === 1) {
    const selected = facet.selectedKeys.values().next().value;
    return facet.options.find((option) => option.id === selected)?.label ?? "Any";
  }
  return `${facet.selectedKeys.size} selected`;
}

function TableFilterCheckbox({ isSelected, label }: { isSelected: boolean; label: string }) {
  return (
    <Checkbox
      isReadOnly
      aria-label={label}
      className="pointer-events-none shrink-0 [&_input]:hidden"
      isSelected={isSelected}
    >
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}

export function TableFilterMenu({ ariaLabel, facets, onClear }: TableFilterMenuProps) {
  const activeFilterCount = facets.filter(
    (facet) => !selectionsMatch(facet.selectedKeys, facet.defaultSelectedKeys ?? emptySelection),
  ).length;
  const handleRootAction = useEventCallback((key: string | number) => {
    if (key === "clear") onClear();
  });

  return (
    <Dropdown>
      <Button
        isIconOnly
        aria-label={ariaLabel}
        className="relative rounded-full"
        size="sm"
        variant="tertiary"
      >
        <HugeiconsIcon icon={FilterHorizontalIcon} />
        {activeFilterCount > 0 ? (
          <span className="bg-accent text-accent-foreground absolute -right-1 -top-1 grid size-4 place-items-center rounded-full text-[10px] font-medium">
            {activeFilterCount}
          </span>
        ) : null}
      </Button>

      <Dropdown.Popover className="min-w-72" placement="bottom end">
        <Dropdown.Menu onAction={handleRootAction}>
          {facets.map((facet) => (
            <Dropdown.SubmenuTrigger key={facet.id}>
              <Dropdown.Item id={facet.id} textValue={facet.label}>
                {facet.icon}
                <Label>{facet.label}</Label>
                <span className="ml-auto max-w-24 truncate text-xs text-muted">
                  {selectionSummary(facet)}
                </span>
                <Dropdown.SubmenuIndicator />
              </Dropdown.Item>
              <Dropdown.Popover className="min-w-64">
                <Dropdown.Menu
                  selectedKeys={facet.selectedKeys}
                  selectionMode={facet.selectionMode ?? "multiple"}
                  {...(facet.disallowEmptySelection === undefined
                    ? {}
                    : { disallowEmptySelection: facet.disallowEmptySelection })}
                  onSelectionChange={facet.onSelectionChange}
                >
                  {facet.options.length === 0 ? (
                    <Dropdown.Item
                      id="empty"
                      isDisabled
                      textValue={facet.emptyLabel ?? "No options"}
                    >
                      <Label>{facet.emptyLabel ?? "No options"}</Label>
                    </Dropdown.Item>
                  ) : null}
                  {facet.groups
                    ? facet.groups.map((group) => {
                        const options = facet.options.filter((option) => option.group === group);
                        if (options.length === 0) return null;
                        return (
                          <Dropdown.Section key={group}>
                            <Header className="px-2 py-2 text-xs font-medium text-muted">
                              {group}
                            </Header>
                            {options.map((option) =>
                              renderFilterOption(option, facet.selectedKeys),
                            )}
                          </Dropdown.Section>
                        );
                      })
                    : facet.options.map((option) => renderFilterOption(option, facet.selectedKeys))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.SubmenuTrigger>
          ))}

          <Dropdown.Item id="clear" isDisabled={activeFilterCount === 0} textValue="Clear filters">
            <HugeiconsIcon className="size-4 text-muted" icon={FilterRemoveIcon} />
            <Label>Clear filters</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

export type { TableFilterFacet, TableFilterMenuProps, TableFilterOption };

function renderFilterOption(option: TableFilterOption, selectedKeys: ReadonlySet<string>) {
  return (
    <Dropdown.Item id={option.id} key={option.id} textValue={option.label}>
      <TableFilterCheckbox
        isSelected={selectedKeys.has(option.id)}
        label={`Filter by ${option.label}`}
      />
      {option.content ?? <Label>{option.label}</Label>}
      {option.count === undefined ? null : (
        <span className="ml-auto text-xs tabular-nums text-muted">{option.count}</span>
      )}
    </Dropdown.Item>
  );
}
