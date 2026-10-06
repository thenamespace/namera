// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useState } from "react";

import { Button, Input, Typography } from "@namera-ai/ui";
import { HugeiconsIcon } from "@namera-ai/ui/icons";

import { sessionPolicyCatalog, type PolicyChoice } from "./catalog";

export function PolicyPicker({
  unavailable,
  onSelect,
}: {
  unavailable: (choice: PolicyChoice) => string | undefined;
  onSelect: (choice: PolicyChoice) => void;
}) {
  const [search, setSearch] = useState("");
  const choices = sessionPolicyCatalog.filter((entry) =>
    `${entry.name} ${entry.description}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="min-w-0 flex-1"
          aria-label="Search policies"
          placeholder="Search policies…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          variant="secondary"
        />
      </div>
      <div className="grid gap-4 p-0.5">
        {(["Access", "Limits", "Advanced"] as const).map((group) => {
          const entries = choices.filter((entry) => entry.group === group);
          if (!entries.length) return null;
          return (
            <section key={group} className="grid gap-2 sm:grid-cols-2" aria-label={group}>
              <Typography.Heading
                level={3}
                className="col-span-full text-xs font-medium text-muted"
              >
                {group}
              </Typography.Heading>
              {entries.map((entry) => {
                const reason = unavailable(entry);
                const disabled = reason !== undefined;
                return (
                  <Button
                    key={entry.id}
                    type="button"
                    variant="ghost"
                    className="border-separator h-auto min-h-18 w-full items-start justify-start gap-3 rounded-lg border p-3 text-left whitespace-normal"
                    isDisabled={disabled}
                    aria-label={`${disabled ? `${reason}:` : "Configure"} ${entry.name}`}
                    onPress={() => onSelect(entry)}
                  >
                    <span className="bg-default text-muted grid size-9 shrink-0 place-items-center rounded-lg">
                      <HugeiconsIcon icon={entry.icon} size={18} />
                    </span>
                    <span className="grid min-w-0 flex-1 gap-1">
                      <span className="text-sm font-medium">{entry.name}</span>
                      <span className="text-muted text-xs leading-4 font-normal">
                        {reason ?? entry.description}
                      </span>
                    </span>
                  </Button>
                );
              })}
            </section>
          );
        })}
        {!choices.length ? (
          <div className="grid justify-items-center gap-2 py-10">
            <Typography.Paragraph>No matching policies</Typography.Paragraph>
            <Button type="button" variant="tertiary" size="sm" onPress={() => setSearch("")}>
              Clear search
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
