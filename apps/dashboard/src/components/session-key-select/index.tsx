import { useMemo, type FocusEventHandler, type Ref } from "react";

import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import { Collection, Header, ListBox, Select, Typography } from "@namera-ai/ui";
import { useEventCallback } from "usehooks-ts";

import { MetadataDisplay } from "@/components/display";
import { SessionKeyCustodyDisplay } from "@/components/display/session-key-custody-display";

import { sessionKeyPolicyCount } from "./policy-count";

type SessionKeyGroup = {
  id: string;
  sessionKeys: ReadonlyArray<SessionKeyResponse>;
  wallet: SessionKeyResponse["wallet"];
};

type SessionKeySelectProps = {
  "aria-labelledby": string;
  isInvalid?: boolean;
  name?: string;
  sessionKeys: ReadonlyArray<SessionKeyResponse>;
  triggerRef?: Ref<HTMLButtonElement>;
  value: ReadonlyArray<string>;
  onBlur?: FocusEventHandler<Element>;
  onChange: (value: string[]) => void;
};

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function groupSessionKeys(sessionKeys: ReadonlyArray<SessionKeyResponse>): SessionKeyGroup[] {
  const groups = new Map<string, SessionKeyGroup>();

  for (const sessionKey of sessionKeys) {
    const existing = groups.get(sessionKey.wallet.id);
    if (existing) {
      groups.set(sessionKey.wallet.id, {
        ...existing,
        sessionKeys: [...existing.sessionKeys, sessionKey],
      });
      continue;
    }

    groups.set(sessionKey.wallet.id, {
      id: sessionKey.wallet.id,
      sessionKeys: [sessionKey],
      wallet: sessionKey.wallet,
    });
  }

  return [...groups.values()];
}

export function SessionKeySelect({
  "aria-labelledby": ariaLabelledBy,
  isInvalid,
  name,
  sessionKeys,
  triggerRef,
  value,
  onBlur,
  onChange,
}: SessionKeySelectProps) {
  const groups = useMemo(() => groupSessionKeys(sessionKeys), [sessionKeys]);
  const selectedValues = useMemo(() => [...value], [value]);
  const handleSelectionChange = useEventCallback((keys: ReadonlyArray<string | number>) => {
    onChange(keys.map(String));
  });
  const selectedSummary = useMemo(() => {
    if (value.length === 0) return "Select access by account";

    const selectedIds = new Set(value);
    const accountCount = groups.reduce(
      (count, group) =>
        group.sessionKeys.some((sessionKey) => selectedIds.has(sessionKey.id)) ? count + 1 : count,
      0,
    );
    return `${value.length} key${value.length === 1 ? "" : "s"} across ${accountCount} account${accountCount === 1 ? "" : "s"}`;
  }, [groups, value]);

  return (
    <Select<SessionKeyResponse, "multiple">
      aria-labelledby={ariaLabelledBy}
      fullWidth
      {...(isInvalid === undefined ? {} : { isInvalid })}
      {...(name === undefined ? {} : { name })}
      selectionMode="multiple"
      value={selectedValues}
      variant="secondary"
      onChange={handleSelectionChange}
    >
      <Select.Trigger {...(onBlur === undefined ? {} : { onBlur })} ref={triggerRef}>
        <Select.Value>{selectedSummary}</Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="w-(--trigger-width) min-w-80">
        <ListBox>
          {sessionKeys.length === 0 ? (
            <ListBox.Item id="empty" isDisabled textValue="No session keys">
              No session keys
            </ListBox.Item>
          ) : null}
          {groups.map((group) => (
            <ListBox.Section id={group.id} key={group.id}>
              <Header className="border-separator flex items-center justify-between gap-3 border-b px-3 py-2 mb-2">
                <MetadataDisplay fallbackName="Unnamed account" metadata={group.wallet.metadata} />
                <div className="flex shrink-0 items-center gap-2">
                  <code className="text-xs text-muted">
                    {truncateAddress(group.wallet.address)}
                  </code>
                  <Typography className="text-xs! tabular-nums" color="muted">
                    {group.sessionKeys.length}
                  </Typography>
                </div>
              </Header>
              <Collection items={group.sessionKeys}>
                {(sessionKey) => {
                  const count = sessionKeyPolicyCount(sessionKey);
                  return (
                    <ListBox.Item
                      id={sessionKey.id}
                      textValue={`${sessionKey.metadata.name} ${group.wallet.metadata.name}`}
                    >
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pl-2">
                        <div className="grid min-w-0 gap-1">
                          <MetadataDisplay
                            fallbackName="Unnamed session key"
                            metadata={sessionKey.metadata}
                          />
                          <SessionKeyCustodyDisplay custody={sessionKey.signer.custody} />
                        </div>
                        <Typography className="shrink-0 text-xs! pr-6" color="muted">
                          {count} {count === 1 ? "policy" : "policies"}
                        </Typography>
                      </div>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  );
                }}
              </Collection>
            </ListBox.Section>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export type { SessionKeySelectProps };
