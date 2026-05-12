import { GoogleLogoIcon } from "@phosphor-icons/react";

import { HeadingGroup } from "@/components/misc";
import { Button } from "@namera-ai/ui/components/ui/button";
import { Card, CardContent } from "@namera-ai/ui/components/ui/card";
import { DeviceIcon } from "@namera-ai/ui/icons";

export const SecurityContainer = () => {
  return (
    <div className="flex w-full flex-col gap-4">
      <HeadingGroup size="lg" heading="Security" />
      <HeadingGroup
        size="md"
        heading="Sessions"
        description="Manage your sessions and access your account."
        className="pb-0"
      />

      <Card className="hover:bg-accent/50 transition-all" size="sm">
        <CardContent className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-3">
            <div className="bg-accent flex size-10 items-center justify-center rounded-xl">
              <DeviceIcon
                browser="chrome"
                os="android"
                className="text-muted-foreground size-6"
              />
            </div>
            <div className="flex flex-col">
              <div className="text-[13px]">Chrome on Mac</div>
              <div className="text-muted-foreground flex flex-row items-center gap-1 text-[11px]">
                <div className="flex flex-row items-center gap-1 text-green-500">
                  <div className="size-1.5 animate-pulse rounded-full bg-green-500"></div>
                  Current Session
                </div>
                <span>Mumbai, India</span>
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="opacity-0 group-hover/card:opacity-100"
          >
            Logout
          </Button>
        </CardContent>
      </Card>

      <HeadingGroup
        size="md"
        heading="Connected Accounts"
        description="Manage your connected accounts."
        className="pb-0"
      />
      <Card className="hover:bg-accent/50 transition-all" size="sm">
        <CardContent className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-3">
            <div className="bg-accent flex size-10 items-center justify-center rounded-xl">
              <GoogleLogoIcon className="text-muted-foreground size-6" />
            </div>
            <div className="flex flex-col">
              <div className="text-[13px]">Google</div>
              <div className="text-muted-foreground text-[11px]">
                Use your Google account to sign in to Namera.
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="opacity-0 group-hover/card:opacity-100"
          >
            Coming Soon
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
