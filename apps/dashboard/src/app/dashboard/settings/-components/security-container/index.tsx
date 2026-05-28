import type { ListSessionsResponse } from "@namera-ai/schema/dto";

import { GoogleLogoIcon } from "@phosphor-icons/react";
import { UAParser } from "ua-parser-js";

import { HeadingGroup } from "@/components/misc";
import { useListSessions } from "@/hooks/auth";
import { useIpLocation } from "@/hooks/misc";
import { Button } from "@namera-ai/ui/components/ui/button";
import { Card, CardContent } from "@namera-ai/ui/components/ui/card";
import { DeviceIcon } from "@namera-ai/ui/icons";

export const SecurityContainer = () => {
  const { data: activeSessions } = useListSessions();
  return (
    <div className="flex w-full flex-col gap-4">
      <HeadingGroup size="lg" heading="Security" />
      <HeadingGroup
        size="md"
        heading="Sessions"
        description="Manage your sessions and access your account."
        className="pb-0"
      />

      {activeSessions?.map((s) => (
        <SessionCard key={s.id} {...s} />
      ))}

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

const SessionCard = ({
  metadata: { ipAddress, userAgent },
}: ListSessionsResponse[number]) => {
  const { data: location } = useIpLocation(ipAddress ?? undefined);
  const { browser, os } = UAParser(userAgent ?? "");
  return (
    <Card size="sm">
      <CardContent className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-3">
          <div className="bg-accent flex size-10 items-center justify-center rounded-xl">
            <DeviceIcon
              browser={browser.toString()}
              os={os.toString()}
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
              {location && (
                <span>
                  {location.city}, {location.regionCode}, {location.country}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
