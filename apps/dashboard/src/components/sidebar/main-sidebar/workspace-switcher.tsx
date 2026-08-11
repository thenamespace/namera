"use client";

import type { Key } from "react";

import { Button, Dropdown, Label } from "@namera-ai/ui";
import { ArrowDown01Icon, HugeiconsIcon, LogoutSquare01Icon } from "@namera-ai/ui/icons";

export function WorkspaceSwitcher() {
  // oxlint-disable-next-line unicorn/consistent-function-scoping react-perf/jsx-no-new-function-as-prop
  const onAction = (key: Key) => {
    // oxlint-disable-next-line no-console
    console.log(key);
  };
  return (
    <Dropdown>
      <Button aria-label="Account Menu" variant="ghost" className="rounded-lg px-2">
        <img src="https://euc.li/envoy1084.eth" alt="icon" className="size-6 rounded-lg" />
        <span>Envoy1084</span>
        <HugeiconsIcon icon={ArrowDown01Icon} className="size-5" />
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={onAction}>
          <Dropdown.Item id="copy-link" textValue="Settings">
            <Label>Settings</Label>
          </Dropdown.Item>
          <Dropdown.Item id="invite" textValue="Invite & manage members">
            <Label>Invite & manage members</Label>
          </Dropdown.Item>
          <Dropdown.SubmenuTrigger>
            <Dropdown.Item id="switch-workspace" textValue="Switch Workspace">
              <Label>Switch Workspace</Label>
              <Dropdown.SubmenuIndicator />
            </Dropdown.Item>
            <Dropdown.Popover>
              <Dropdown.Menu>
                <Dropdown.Item id="whatsapp" textValue="WhatsApp">
                  <Label>WhatsApp</Label>
                </Dropdown.Item>
                <Dropdown.Item id="telegram" textValue="Telegram">
                  <Label>Telegram</Label>
                </Dropdown.Item>
                <Dropdown.Item id="discord" textValue="Discord">
                  <Label>Discord</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.SubmenuTrigger>
          <Dropdown.Item id="logout" textValue="Logout" variant="danger">
            <Label className="flex flex-row items-center gap-2">
              <HugeiconsIcon icon={LogoutSquare01Icon} className="size-5 text-danger" />
              Logout
            </Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
