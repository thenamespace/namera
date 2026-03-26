import { createFileRoute, Outlet } from "@tanstack/react-router";

import { Navbar } from "@/components";

const BlogLayout = () => {
  return (
    <div>
      <Navbar />
      <Outlet />
    </div>
  );
};

export const Route = createFileRoute("/blog")({
  component: BlogLayout,
});
