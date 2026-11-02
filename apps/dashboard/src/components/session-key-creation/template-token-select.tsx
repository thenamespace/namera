// oxlint-disable react-perf/jsx-no-new-function-as-prop
import type { ComponentProps } from "react";

import type { TemplateToken } from "@namera-ai/templates";
import { ListBox, Select } from "@namera-ai/ui";

type TemplateTokenSelectProps = {
  "aria-labelledby": string;
  "aria-describedby": string;
  name: string;
  options: readonly TemplateToken[];
  value: readonly string[];
  onChange: (tokens: readonly string[]) => void;
  onBlur: () => void;
  triggerRef: ComponentProps<typeof Select.Trigger>["ref"];
  isInvalid: boolean;
  isDisabled: boolean;
};

export function TemplateTokenSelect({
  options,
  value,
  onChange,
  onBlur,
  triggerRef,
  ...props
}: TemplateTokenSelectProps) {
  const selectedTokens = options.filter((token) => value.includes(token.id));

  return (
    <Select<TemplateToken, "multiple">
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
                width={20}
                height={20}
                className="size-5 shrink-0 rounded-full"
              />
              <span className="min-w-0 flex-1 truncate pr-6">{token.symbol}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
