import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@namera-ai/ui/components/ui/button";

export const Home = () => {
  return (
    <div>
      <h1>Home</h1>
      <Link params={{}} to="/docs/$">
        Docs
      </Link>
      <Button>Button</Button>
    </div>
  );
};

export const Route = createFileRoute("/")({ component: Home });
