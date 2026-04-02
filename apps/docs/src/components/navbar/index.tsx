import { Link } from "@tanstack/react-router";

import { Button } from "@namera-ai/ui/components/ui/button";
import { NameraIcon } from "@namera-ai/ui/icons";
import { usePostHog } from "@posthog/react";

import { Menu } from "./menu";

export const Navbar = () => {
  const posthog = usePostHog();

  return (
    <nav className="w-full grow flex bg-[#0B0C14]/80 backdrop-blur-2xl z-100 fixed top-0 px-4 h-13 items-center justify-center helvetica">
      <div className="max-w-6xl border-b w-full flex justify-between items-center text-accent-foreground h-13">
        <div className="flex flex-row items-center gap-6 text-[13px]">
          <Link className="flex items-center gap-1.5" to="/">
            <NameraIcon className="fill-accent-foreground size-4" />
            <span className="font-medium text-[16px]">Namera</span>
          </Link>
          <Menu />
        </div>
        <div className="flex flex-row items-center gap-2">
          {/* <Button size="sm" variant="ghost">
            Sign in
          </Button> */}
          <Button
            className="cta-button"
            nativeButton={false}
            render={
              <Link
                onClick={() =>
                  posthog.capture("navbar_get_started_clicked", {
                    location: "navbar",
                  })
                }
                to="/docs/$"
              />
            }
            size="sm"
          >
            Get Started
          </Button>
        </div>
      </div>
    </nav>
  );
};
