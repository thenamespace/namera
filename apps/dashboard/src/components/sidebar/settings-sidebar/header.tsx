import { Link } from "@tanstack/react-router";

import { CaretLeftIcon } from "@phosphor-icons/react";

import { Button } from "@namera-ai/ui/components/ui/button";
import { SidebarHeader } from "@namera-ai/ui/components/ui/sidebar";

export const Header = () => {
  return (
    <SidebarHeader className="w-fit px-2 py-4">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit rounded-full"
        render={<Link to="/dashboard" />}
      >
        <CaretLeftIcon />
        Back to app
      </Button>
    </SidebarHeader>
  );
};
