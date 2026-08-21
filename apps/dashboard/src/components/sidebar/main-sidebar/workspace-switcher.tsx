import type { Key } from "react";

import { useNavigate } from "@tanstack/react-router";

import { Button, Dropdown, IconPreview, Label } from "@namera-ai/ui";
import {
  ArrowDown01Icon,
  Add01Icon,
  HugeiconsIcon,
  LogoutSquare01Icon,
  Tick02Icon,
} from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { HotkeyHint } from "@/components/hotkey-hint";
import {
  useCurrentUser,
  useLogout,
  useSwitchOrganization,
  useUserOrganizations,
} from "@/hooks/auth";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

const defaultWorkspaceLogo = { type: "emoji", value: "🏢" } as const;
const settingsHotkeySequence = ["G", "S"] as const;

export function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const organizations = useUserOrganizations();
  const switchOrganization = useSwitchOrganization({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t switch workspace",
        description: "You are still in the current workspace.",
      }),
    onSuccess: (_, variables) => {
      const selected = organizations.data?.find(
        ({ organization }) => organization.id === variables.payload.organizationId,
      );

      showSuccessToast(
        selected === undefined
          ? { title: "Workspace switched" }
          : {
              title: "Workspace switched",
              description: selected.organization.metadata.name,
            },
      );
    },
  });
  const logout = useLogout({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t log out",
        description: "Your session is still active.",
      }),
    onSuccess: () => void navigate({ to: "/auth", replace: true }),
  });
  const activeOrganization = currentUser.data?.organization;

  const handleAction = useEventCallback(async (key: Key) => {
    if (key === "settings") {
      await navigate({ to: "/settings/profile" });
      return;
    }
    if (key === "members") {
      await navigate({ to: "/settings/workspace/members" });
      return;
    }
    if (key === "new-workspace") {
      await navigate({ to: "/workspace/new" });
      return;
    }
    if (key === "logout") {
      logout.mutate();
      return;
    }

    const selected = organizations.data?.find(({ organization }) => organization.id === key);
    if (!selected || selected.organization.id === activeOrganization?.id) return;

    switchOrganization.mutate({
      payload: { organizationId: selected.organization.id },
    });
  });

  return (
    <Dropdown>
      <Button aria-label="Organization menu" className="rounded-lg px-2" variant="ghost">
        <IconPreview size="xs" value={activeOrganization?.metadata.logo ?? defaultWorkspaceLogo} />
        <span className="max-w-36 truncate">
          {activeOrganization?.metadata.name ?? "Organization"}
        </span>
        <HugeiconsIcon className="size-5" icon={ArrowDown01Icon} />
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={handleAction}>
          <Dropdown.Item id="settings" textValue="Settings">
            <Label>Settings</Label>
            <span className="ml-auto">
              <HotkeyHint sequence={settingsHotkeySequence} />
            </span>
          </Dropdown.Item>
          <Dropdown.Item id="members" textValue="Invite and manage members">
            <Label>Invite & manage members</Label>
          </Dropdown.Item>
          <Dropdown.SubmenuTrigger>
            <Dropdown.Item id="switch-workspace" textValue="Switch organization">
              <Label>Switch organization</Label>
              <Dropdown.SubmenuIndicator />
            </Dropdown.Item>
            <Dropdown.Popover>
              <Dropdown.Menu onAction={handleAction}>
                <Dropdown.Item id="new-workspace" textValue="Create workspace">
                  <HugeiconsIcon className="size-4 text-muted" icon={Add01Icon} />
                  <Label>Create workspace</Label>
                </Dropdown.Item>
                {(organizations.data ?? []).map(({ organization }) => (
                  <Dropdown.Item
                    id={organization.id}
                    key={organization.id}
                    textValue={organization.metadata.name}
                  >
                    <IconPreview
                      size="xs"
                      value={organization.metadata.logo ?? defaultWorkspaceLogo}
                    />
                    <Label>{organization.metadata.name}</Label>
                    {organization.id === activeOrganization?.id ? (
                      <HugeiconsIcon className="ml-auto size-4" icon={Tick02Icon} />
                    ) : null}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.SubmenuTrigger>
          <Dropdown.Item id="logout" textValue="Logout" variant="danger">
            <Label className="flex flex-row items-center gap-2">
              <HugeiconsIcon className="size-5 text-danger" icon={LogoutSquare01Icon} />
              Logout
            </Label>
            <span className="ml-auto">
              <HotkeyHint hotkey="Shift+Q" />
            </span>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
