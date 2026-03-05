import { createFileRoute } from "@tanstack/react-router";

import { ConnectButton } from "@/components";

export const Home = () => {
  return (
    <div>
      <ConnectButton />
    </div>
  );
};

export const Route = createFileRoute("/")({ component: Home });
