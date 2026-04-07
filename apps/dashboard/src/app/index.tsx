import { createFileRoute, Link } from "@tanstack/react-router";

import { ConnectButton } from "@/components";
import { Button } from "@namera-ai/ui/components/ui/button";

export const Home = () => {
  return (
    <div>
      <ConnectButton />
      <Button render={<Link to="/dashboard" />}>Dashboard</Button>
    </div>
  );
};

export const Route = createFileRoute("/")({ component: Home });
