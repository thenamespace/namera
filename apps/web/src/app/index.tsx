import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@repo/ui/components/ui/button";

import { ConnectButton } from "@/components";

export const Home = () => {
  return (
    <div>
      <ConnectButton />
      <Button render={<Link to="/dashboard" />}>Dashboard</Button>
    </div>
  );
};

export const Route = createFileRoute("/")({ component: Home });
