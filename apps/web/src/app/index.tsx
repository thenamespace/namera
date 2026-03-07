import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@repo/ui/components/ui/button";

import { ConnectButton } from "@/components";

export const Home = () => {
  return (
    <div>
      <ConnectButton />
      <Button render={<Link to="/dashboard" />}>Dashboard</Button>
      <Button
        render={
          <Link
            params={{
              // biome-ignore lint/style/useNamingConvention: safe
              _splat: "",
            }}
            to="/docs/$"
          />
        }
      >
        Docs
      </Button>
    </div>
  );
};

export const Route = createFileRoute("/")({ component: Home });
