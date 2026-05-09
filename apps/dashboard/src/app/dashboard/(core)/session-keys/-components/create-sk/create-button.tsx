import { Link } from "@tanstack/react-router";

import { PlusIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@namera-ai/ui/components/ui/button";
import { Kbd } from "@namera-ai/ui/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@namera-ai/ui/components/ui/tooltip";

export const CreateSessionKeyButton = () => {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="group"
            render={<Link to="/dashboard/session-keys/create" />}
          />
        }
      >
        <PlusIcon />
      </TooltipTrigger>
      <TooltipContent className="text-xs">
        <div className="flex flex-row items-center gap-1">
          <div>Create a new session key</div>
          <div>
            <Kbd>N</Kbd> then <Kbd>S</Kbd>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
