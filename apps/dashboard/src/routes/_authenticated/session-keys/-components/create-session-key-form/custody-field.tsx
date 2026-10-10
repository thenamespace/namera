// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { Field, FieldError, FieldLabel, ListBox, Select, Chip } from "@namera-ai/ui";
import { NameraIcon } from "@namera-ai/ui/icons";
import { Controller, type Control } from "react-hook-form";

import { DashboardCardRow } from "@/components/dashboard-card";
import { SessionKeyCustodyDisplay } from "@/components/display/session-key-custody-display";

import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "./types";

export type CustodyLimits = Readonly<{ local: boolean; managed: boolean }>;

export function CustodyField({
  control,
  locked,
  limits,
}: {
  control: Control<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
  locked: boolean;
  limits: CustodyLimits;
}) {
  return (
    <Controller
      control={control}
      name="custody"
      render={({ field }) => {
        const limitReached = field.value === "local" ? limits.local : limits.managed;
        return (
          <DashboardCardRow>
            <Field className="contents">
              <FieldLabel id="session-custody-label">Custody</FieldLabel>
              <div className="grid min-w-0 gap-2">
                <Select
                  aria-labelledby="session-custody-label"
                  {...(limitReached ? { "aria-describedby": "session-custody-limit" } : {})}
                  fullWidth
                  variant="secondary"
                  isDisabled={locked}
                  name={field.name}
                  selectedKey={field.value}
                  onSelectionChange={field.onChange}
                >
                  <Select.Trigger ref={field.ref} onBlur={field.onBlur}>
                    <Select.Value>
                      <SessionKeyCustodyDisplay custody={field.value} />
                    </Select.Value>
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="local" textValue="User Owned" isDisabled={limits.local}>
                        <SessionKeyCustodyDisplay custody="local" />
                        {limits.local ? (
                          <Chip size="sm" variant="soft" className="ml-auto shrink-0">
                            Limit reached
                          </Chip>
                        ) : null}
                      </ListBox.Item>
                      <ListBox.Item
                        id="namera-managed"
                        textValue="1Claw Managed"
                        isDisabled={limits.managed}
                      >
                        <SessionKeyCustodyDisplay custody="namera-managed" />
                        {limits.managed ? (
                          <Chip size="sm" variant="soft" className="ml-auto shrink-0">
                            Limit reached
                          </Chip>
                        ) : null}
                      </ListBox.Item>
                      <ListBox.Item
                        id="coming-soon"
                        isDisabled
                        textValue="Namera Managed — coming soon"
                      >
                        <span className="inline-flex items-center gap-2">
                          <NameraIcon aria-hidden className="size-4 shrink-0 fill-current" />
                          Namera Managed
                        </span>
                        <Chip size="sm" variant="soft" className="ml-auto shrink-0">
                          Coming soon
                        </Chip>
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
                {limitReached ? (
                  <FieldError id="session-custody-limit">
                    Limit reached for this custody. Choose another option or remove an unused
                    session key.
                  </FieldError>
                ) : null}
              </div>
            </Field>
          </DashboardCardRow>
        );
      }}
    />
  );
}
