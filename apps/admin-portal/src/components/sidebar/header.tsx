import { useCallback, type Key } from "react";

import { useNavigate } from "@tanstack/react-router";

import { Button, Dropdown, Label, Sidebar, toast } from "@namera-ai/ui";
import {
  ArrowDown01Icon,
  HugeiconsIcon,
  LogoutSquare01Icon,
  NameraIcon,
  UserGroupIcon,
} from "@namera-ai/ui/icons";

import { usePermissions } from "@/components/permission";
import { useLogout } from "@/hooks/auth";
import { authErrorMessage } from "@/lib/auth-feedback";

export function SidebarHeader() {
  const navigate = useNavigate();
  const canManageTeam = usePermissions().includes("team:manage");
  const { mutate: logout, isPending } = useLogout({
    onSuccess: () => {
      // A document navigation also discards all protected in-memory query state.
      window.location.replace("/auth");
    },
    onError: (error) =>
      toast.danger("Couldn’t log out", {
        description: authErrorMessage(error, "Your session is still active."),
      }),
  });
  const handleAction = useCallback(
    (key: Key) => {
      if (key === "members") void navigate({ to: "/team" });
      if (key === "logout") logout({});
    },
    [navigate, logout],
  );

  return (
    <Sidebar.Header className="px-1!">
      <div className="flex items-center gap-3 px-1 py-2">
        <Dropdown>
          <Button
            aria-label="Admin menu"
            className="rounded-lg px-2"
            variant="ghost"
            isDisabled={isPending}
          >
            <NameraIcon aria-hidden="true" className="fill-foreground h-[1cap] w-auto shrink-0" />
            <span>
              Namera <span className="text-muted font-normal">Admin</span>
            </span>
            <HugeiconsIcon className="size-5" icon={ArrowDown01Icon} />
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu onAction={handleAction}>
              {canManageTeam ? (
                <Dropdown.Item id="members" textValue="Invite and manage members">
                  <HugeiconsIcon className="size-4 text-muted" icon={UserGroupIcon} />
                  <Label>Invite &amp; manage members</Label>
                </Dropdown.Item>
              ) : null}
              <Dropdown.Item id="logout" textValue="Logout" variant="danger">
                <Label className="flex flex-row items-center gap-2">
                  <HugeiconsIcon className="size-5 text-danger" icon={LogoutSquare01Icon} />
                  Logout
                </Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </Sidebar.Header>
  );
}
