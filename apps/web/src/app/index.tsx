import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@repo/ui/components/ui/button";

import { ConnectButton } from "@/components";
import { currentUser, health, signIn } from "@/lib/server";

export const Home = () => {
  return (
    <div>
      <ConnectButton />
      <Button render={<Link to="/dashboard" />}>Dashboard</Button>
      <Button
        onClick={async () => {
          const res = await health();
          console.log("res", res);
        }}
      >
        Health
      </Button>
      <Button
        onClick={async () => {
          const res = await signIn();
          console.log("res", res);
        }}
      >
        Sign In
      </Button>
      <Button
        onClick={async () => {
          const res = await currentUser();
          console.log("res", res);
        }}
      >
        Current User
      </Button>
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
