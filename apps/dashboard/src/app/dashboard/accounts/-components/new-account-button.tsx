import { useHotkeySequence } from "@tanstack/react-hotkeys";
import { Link, useNavigate } from "@tanstack/react-router";

import { PlusIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@namera-ai/ui/components/ui/button";
import { Kbd } from "@namera-ai/ui/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@namera-ai/ui/components/ui/tooltip";

export const CreateAccountButton = () => {
  const navigate = useNavigate();
  useHotkeySequence(["N", "A"], () => {
    navigate({ to: "/dashboard/accounts/new" });
  });

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="group"
            render={<Link to="/dashboard/accounts/new" />}
          />
        }
      >
        <PlusIcon />
      </TooltipTrigger>
      <TooltipContent className="text-xs">
        <div className="flex flex-row items-center gap-1">
          <div>Create a new account</div>
          <div>
            <Kbd>N</Kbd> then <Kbd>A</Kbd>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
