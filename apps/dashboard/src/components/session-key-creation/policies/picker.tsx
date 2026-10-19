// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useState } from "react";

import { Button, Input, Typography } from "@namera-ai/ui";
import { HugeiconsIcon } from "@namera-ai/ui/icons";

import { sessionPolicyCatalog, type PolicyChoice } from "./catalog";

const groups = Array.from(new Set(sessionPolicyCatalog.map((entry) => entry.group)));

export function PolicyPicker({
  unavailable,
  onSelect,
}: {
  unavailable: (choice: PolicyChoice) => string | undefined;
  onSelect: (choice: PolicyChoice) => void;
}) {
  const [search, setSearch] = useState("");
  const choices = sessionPolicyCatalog.filter((entry) =>
    `${entry.name} ${entry.description} ${entry.group}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
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
      <div className="grid gap-5 p-0.5">
        {groups.map((group) => {
          const groupedChoices = choices.filter((entry) => entry.group === group);
          if (!groupedChoices.length) return null;
          return (
            <section key={group} aria-label={group} className="grid gap-2">
              <Typography.Heading level={3} weight="medium" className="text-xs text-muted">
                {group}
              </Typography.Heading>
              {groupedChoices.map((entry) => {
                const reason = unavailable(entry);
                const disabled = reason !== undefined;
                return (
                  <Button
                    key={entry.id}
                    type="button"
                    variant="ghost"
                    className="border-separator h-auto min-h-0 w-full items-start justify-start gap-3 rounded-lg border px-3 py-2 text-left whitespace-normal"
                    isDisabled={disabled}
                    aria-label={`${disabled ? `${reason}:` : "Configure"} ${entry.name}`}
                    onPress={() => onSelect(entry)}
                  >
                    <span className="bg-default text-muted grid size-9 shrink-0 place-items-center rounded-lg">
                      <HugeiconsIcon icon={entry.icon} size={18} />
                    </span>
                    <span className="grid min-w-0 flex-1 gap-1">
                      <span className="text-sm font-medium">{entry.name}</span>
                      <span
                        className="text-muted truncate text-xs leading-4 font-normal"
                        title={reason ?? entry.description}
                      >
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
