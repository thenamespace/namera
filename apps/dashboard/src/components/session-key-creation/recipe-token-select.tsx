// oxlint-disable react-perf/jsx-no-new-function-as-prop
import type { ComponentProps } from "react";

import type { RecipeToken } from "@namera-ai/recipes";
import { ListBox, Select } from "@namera-ai/ui";

type RecipeTokenSelectProps = {
  "aria-labelledby": string;
  "aria-describedby": string;
  name: string;
  options: readonly RecipeToken[];
  value: readonly string[];
  onChange: (tokens: readonly string[]) => void;
  onBlur: () => void;
  triggerRef: ComponentProps<typeof Select.Trigger>["ref"];
  isInvalid: boolean;
  isDisabled: boolean;
};

export function RecipeTokenSelect({
  options,
  value,
  onChange,
  onBlur,
  triggerRef,
  ...props
}: RecipeTokenSelectProps) {
  const selectedTokens = options.filter((token) => value.includes(token.id));

  return (
    <Select<RecipeToken, "multiple">
      {...props}
      fullWidth
      isRequired
      selectionMode="multiple"
      value={Array.from(value)}
      onChange={(keys) => onChange(keys.map(String))}
      variant="secondary"
    >
      <Select.Trigger ref={triggerRef} onBlur={onBlur}>
        <Select.Value>
          {selectedTokens.length > 0 ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex shrink-0 items-center gap-1">
                {selectedTokens.map((token) => (
                  <img
                    key={token.id}
                    src={`https://cdn.namera.ai/${token.logo}`}
                    alt=""
                    width={20}
                    height={20}
                    className="size-5 rounded-full"
                  />
                ))}
              </span>
              <span className="truncate">
                {selectedTokens.map((token) => token.symbol).join(", ")}
              </span>
            </span>
          ) : (
            "Select payment tokens"
          )}
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="w-(--trigger-width) overflow-hidden p-1">
        <ListBox items={options}>
          {(token) => (
            <ListBox.Item id={token.id} textValue={`${token.symbol} ${token.name}`}>
              <img
                src={`https://cdn.namera.ai/${token.logo}`}
                alt=""
                width={28}
                height={28}
                className="size-7 shrink-0 rounded-full"
              />
              <div className="grid min-w-0 flex-1 gap-0.5 pr-6">
                <span className="font-medium">{token.symbol}</span>
                <span className="text-xs text-muted">{token.description}</span>
              </div>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
