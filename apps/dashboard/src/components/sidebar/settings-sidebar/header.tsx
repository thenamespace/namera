import { Link } from "@tanstack/react-router";

import { buttonVariants, Sidebar } from "@namera-ai/ui";
import { ChevronLeftIcon, HugeiconsIcon } from "@namera-ai/ui/icons";

export const SidebarHeader = () => {
  return (
    <Sidebar.Header>
      <Link to="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <HugeiconsIcon icon={ChevronLeftIcon} />
        <span>Back to app</span>
      </Link>
    </Sidebar.Header>
  );
};
