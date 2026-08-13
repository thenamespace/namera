import type { Key } from "react";

import { useNavigate } from "@tanstack/react-router";

import { Button, Dropdown, IconPreview, Label, toast } from "@namera-ai/ui";
import {
  ArrowDown01Icon,
  HugeiconsIcon,
  LogoutSquare01Icon,
  Tick02Icon,
} from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import {
  useCurrentUser,
  useLogout,
  useSwitchOrganization,
  useUserOrganizations,
} from "@/hooks/auth";

const defaultWorkspaceLogo = { type: "emoji", value: "🏢" } as const;

export function WorkspaceSwitcher() {
  const currentUser = useCurrentUser();
  const organizations = useUserOrganizations();
  const switchOrganization = useSwitchOrganization();
  const logout = useLogout();
  const navigate = useNavigate();
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
      try {
        await logout.mutateAsync();
        await navigate({ to: "/auth", replace: true });
      } catch {
        toast.danger("Couldn’t log out.");
      }
      return;
    }

    const selected = organizations.data?.find(({ organization }) => organization.id === key);
    if (!selected || selected.organization.id === activeOrganization?.id) return;

    try {
      await switchOrganization.mutateAsync({
        payload: { organizationId: selected.organization.id },
      });
      toast.success(`Switched to ${selected.organization.metadata.name}`);
    } catch {
      toast.danger("Couldn’t switch organizations.");
    }
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
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
