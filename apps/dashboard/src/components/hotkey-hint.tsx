import { formatForDisplay, type Hotkey } from "@tanstack/react-hotkeys";

import { Kbd } from "@namera-ai/ui";

type HotkeyHintProps =
  | { hotkey: Hotkey; sequence?: never }
  | { hotkey?: never; sequence: ReadonlyArray<Hotkey> };

const Key = ({ hotkey }: { hotkey: Hotkey }) => (
  <Kbd className="min-w-5 rounded-md px-1.5">
    <Kbd.Content className="text-[10px] font-normal leading-4">
      {formatForDisplay(hotkey)}
    </Kbd.Content>
  </Kbd>
);

export function HotkeyHint({ hotkey, sequence }: HotkeyHintProps) {
  if (hotkey !== undefined) return <Key hotkey={hotkey} />;

  return (
    <span
      className="flex items-center gap-1 text-[10px] text-muted"
      aria-label={sequence.join(" then ")}
    >
      {sequence.map((key, index) => (
        <span className="contents" key={key}>
          {index > 0 ? <span aria-hidden>then</span> : null}
          <Key hotkey={key} />
        </span>
      ))}
    </span>
  );
}

export type { HotkeyHintProps };
